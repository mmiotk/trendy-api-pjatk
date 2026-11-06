import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { buildSubgraphSchema } from "@apollo/subgraph";
import { parse } from "graphql";
import { createYoga } from "graphql-yoga";

const auctions = [
  { id: "1", itemId: "1", currentPrice: 120, status: "OPEN" },
  { id: "2", itemId: "2", currentPrice: 340, status: "OPEN" },
  { id: "3", itemId: "3", currentPrice: 90, status: "OPEN" },
  { id: "4", itemId: "4", currentPrice: 500, status: "CLOSED" },
];

const resolvers = {
  Query: {
    auctions: () => auctions,
  },
  Auction: {
    // Aukcja zna tylko `id` przedmiotu. Tytuł i opis brama pobierze z subgrafu `catalog`.
    item: (auction: { itemId: string }) => ({ id: auction.itemId }),
  },
  Item: {
    // `bidding` nie ma własnych danych przedmiotu, więc reprezentacja z bramy wystarcza.
    __resolveReference: (reference: { id: string }) => reference,
    auctions: (item: { id: string }) => auctions.filter((auction) => auction.itemId === item.id),
  },
};

const yoga = createYoga({
  schema: buildSubgraphSchema([{ typeDefs: parse(readFileSync("schema/bidding.graphql", "utf8")), resolvers }]),
  plugins: [{ onParams: ({ params }) => console.log("bidding <-", params.query?.replace(/\s+/g, " "), JSON.stringify(params.variables)) }],
});

const port = Number(process.env.PORT ?? 4062);
createServer(yoga).listen(port, () => console.log(`bidding subgraph on http://localhost:${port}/graphql`));
