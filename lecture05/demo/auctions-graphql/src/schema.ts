import { readFileSync } from "node:fs";
import { GraphQLError } from "graphql";
import { createPubSub, createSchema, filter } from "graphql-yoga";
import type { Context } from "./context.ts";
import { applyAuth } from "./directives.ts";
import { auctionSeller, loggedIn, ownProfile, runPipes, validAuctionId } from "./pipes.ts";
import { pageSize } from "./rules.ts";

// Jeden temat w kanale zdarzeń: `publish` wysyła ofertę do wszystkich, którzy nasłuchują `bidPlaced`.
const pubSub = createPubSub<{ bidPlaced: [bid: { id: number; auctionId: number; bidderId: number; amount: number }] }>();

const typeDefs = readFileSync("schema/auctions.graphql", "utf8");

// Kolumny w snake_case dostają aliasy, więc wiersz ma pola o nazwach ze schematu.
const AUCTION_COLUMNS = "id, item_id AS itemId, seller_id AS sellerId, current_price AS currentPrice, status";
const BID_COLUMNS = "id, auction_id AS auctionId, bidder_id AS bidderId, amount";

const resolvers = {
  Query: {
    auction: (_parent: unknown, args: { id: string }, ctx: Context) =>
      ctx.query(`SELECT ${AUCTION_COLUMNS} FROM auctions WHERE id = ?`, args.id)[0] ?? null,
    auctions: (_parent: unknown, args: { limit?: number }, ctx: Context) =>
      ctx.query(`SELECT ${AUCTION_COLUMNS} FROM auctions LIMIT ?`, pageSize(args.limit)),
    searchItems: (_parent: unknown, args: { title: string }, ctx: Context) => {
      // Walidacja długości przed użyciem argumentu.
      if (args.title.length < 1 || args.title.length > 50) {
        throw new GraphQLError("Title must have 1 to 50 characters", { extensions: { code: "BAD_USER_INPUT" } });
      }
      // Wartość trafia do SQL tylko jako parametr `?`. Znaki `%` i `_` w wartości tracą znaczenie wzorca LIKE.
      const pattern = `%${args.title.replace(/[\\%_]/g, "\\$&")}%`;
      return ctx.query("SELECT id, title, description FROM items WHERE title LIKE ? ESCAPE '\\' LIMIT 10", pattern);
    },
  },
  Mutation: {
    // Licytującym jest właściciel tokenu, a nie argument: `@auth` sprawdziła już, że `ctx.me` istnieje.
    placeBid: (_parent: unknown, args: { auctionId: string; amount: number }, ctx: Context) => {
      const auction = ctx.query("SELECT current_price AS currentPrice, status FROM auctions WHERE id = ?", args.auctionId)[0];
      if (!auction) throw new GraphQLError(`Auction ${args.auctionId} does not exist`);
      if (auction.status !== "OPEN") throw new GraphQLError("Auction is closed");
      if (args.amount <= auction.currentPrice) {
        throw new GraphQLError(`Bid must be higher than the current price (${auction.currentPrice})`);
      }
      ctx.query("UPDATE auctions SET current_price = ? WHERE id = ?", args.amount, args.auctionId);
      // RETURNING zwraca wstawiony wiersz bez dodatkowego SELECT-a.
      const bid = ctx.query(
        `INSERT INTO bids (auction_id, bidder_id, amount) VALUES (?, ?, ?) RETURNING ${BID_COLUMNS}`,
        args.auctionId,
        ctx.me!.id,
        args.amount,
      )[0];
      // Mutacja zapisuje ofertę, a potem powiadamia subskrybentów.
      pubSub.publish("bidPlaced", bid);
      return bid;
    },
    closeAuction: (_parent: unknown, args: { id: string }, ctx: Context) => {
      // Łańcuch: logical -> access -> ownership. Dopiero po nim zaczyna się logika mutacji.
      runPipes(ctx, args, [validAuctionId, loggedIn, auctionSeller]);
      const auction = ctx.query(
        `UPDATE auctions SET status = 'CLOSED' WHERE id = ? AND status = 'OPEN' RETURNING ${AUCTION_COLUMNS}`,
        args.id,
      )[0];
      if (!auction) throw new GraphQLError("Auction is already closed");
      return auction;
    },
  },
  Subscription: {
    bidPlaced: {
      // `subscribe` zwraca strumień zdarzeń; `filter` przepuszcza tylko oferty z wybranej aukcji.
      subscribe: (_parent: unknown, args: { auctionId: string }) =>
        filter((bid: { auctionId: number }) => String(bid.auctionId) === args.auctionId)(pubSub.subscribe("bidPlaced")),
      // Zdarzenie jest już ofertą (wierszem), więc `resolve` zwraca je bez zmian.
      resolve: (bid: unknown) => bid,
    },
  },
  Auction: {
    // Nowe pole liczy się z tej samej kolumny co stare, więc oba zawsze się zgadzają.
    currentPriceCents: (parent: { currentPrice: number }) => parent.currentPrice * 100,
    item: (parent: { itemId: number }, _args: unknown, ctx: Context) =>
      ctx.query("SELECT id, title, description FROM items WHERE id = ?", parent.itemId)[0],
    seller: (parent: { sellerId: number }, _args: unknown, ctx: Context) =>
      ctx.query("SELECT id, name FROM users WHERE id = ?", parent.sellerId)[0],
    bids: (parent: { id: number }, _args: unknown, ctx: Context) =>
      ctx.query(`SELECT ${BID_COLUMNS} FROM bids WHERE auction_id = ?`, parent.id),
  },
  Bid: {
    bidder: (parent: { bidderId: number }, _args: unknown, ctx: Context) =>
      ctx.query("SELECT id, name FROM users WHERE id = ?", parent.bidderId)[0],
  },
  User: {
    // Pipes na polu typu `User` działają na każdej ścieżce do użytkownika: `seller` i `bidder`.
    address: (parent: { id: number }, _args: unknown, ctx: Context) => {
      runPipes(ctx, parent, [loggedIn, ownProfile]);
      return ctx.query("SELECT address FROM users WHERE id = ?", parent.id)[0].address;
    },
    auctions: (parent: { id: number }, _args: unknown, ctx: Context) =>
      ctx.query(`SELECT ${AUCTION_COLUMNS} FROM auctions WHERE seller_id = ?`, parent.id),
  },
};

export const schema = applyAuth(createSchema<Context>({ typeDefs, resolvers }));
