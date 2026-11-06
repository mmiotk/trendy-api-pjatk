import { GraphQLError } from "graphql";
import type { Context } from "./context.ts";

// Pipe to zwykła funkcja: dostaje kontekst i wejście, a gdy coś jest nie tak, rzuca błąd.
type Pipe<Input> = (ctx: Context, input: Input) => void;

// Łańcuch uruchamia pipes po kolei; pierwszy błąd przerywa resolver, zanim ruszy jego właściwa logika.
export function runPipes<Input>(ctx: Context, input: Input, pipes: Pipe<Input>[]): void {
  for (const pipe of pipes) pipe(ctx, input);
}

// Logical: czy argument ma sensowny kształt (bez zaglądania do bazy).
export const validAuctionId: Pipe<{ id: string }> = (_ctx, args) => {
  if (!/^\d+$/.test(args.id)) {
    throw new GraphQLError("Auction id must be a number", { extensions: { code: "BAD_USER_INPUT" } });
  }
};

// Access: czy użytkownik jest zalogowany.
export const loggedIn: Pipe<unknown> = (ctx) => {
  if (!ctx.me) throw new GraphQLError("You must be logged in", { extensions: { code: "UNAUTHENTICATED" } });
};

// Ownership: czy zasób należy do tego użytkownika.
export const auctionSeller: Pipe<{ id: string }> = (ctx, args) => {
  const auction = ctx.query("SELECT seller_id AS sellerId FROM auctions WHERE id = ?", args.id)[0];
  if (!auction) throw new GraphQLError(`Auction ${args.id} does not exist`, { extensions: { code: "NOT_FOUND" } });
  if (auction.sellerId !== ctx.me!.id) {
    throw new GraphQLError("Only the seller can close this auction", { extensions: { code: "FORBIDDEN" } });
  }
};

// Ownership dla typu: wejściem jest użytkownik, którego pole ktoś czyta.
export const ownProfile: Pipe<{ id: number }> = (ctx, user) => {
  if (user.id !== ctx.me!.id) throw new GraphQLError("Address is private", { extensions: { code: "FORBIDDEN" } });
};
