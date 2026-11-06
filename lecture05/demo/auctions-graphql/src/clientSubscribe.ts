import { setTimeout as sleep } from "node:timers/promises";
import { ApolloClient, ApolloLink, HttpLink, InMemoryCache, gql } from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";

const port = process.env.PORT ?? 4050;

// Dwa transporty: zapytania i mutacje idą przez HTTP, subskrypcje przez WebSocket.
// Mutacja wymaga tokenu, więc wszystkie oferty składa Nina.
const httpLink = new HttpLink({ uri: `http://localhost:${port}/graphql`, headers: { authorization: "Bearer nina-token" } });
const wsLink = new GraphQLWsLink(createClient({ url: `ws://localhost:${port}/graphql` }));

const client = new ApolloClient({
  // `split` sprawdza rodzaj operacji: dla `true` wybiera pierwszy link, dla `false` drugi.
  link: ApolloLink.split((operation) => operation.operationType === "subscription", wsLink, httpLink),
  cache: new InMemoryCache(),
});

const BID_PLACED = gql`
  subscription BidPlaced($auctionId: ID!) {
    bidPlaced(auctionId: $auctionId) { id amount bidder { name } }
  }
`;

const PLACE_BID = gql`
  mutation PlaceBid($auctionId: ID!, $amount: Int!) {
    placeBid(auctionId: $auctionId, amount: $amount) { id }
  }
`;

// Subskrypcja aukcji 1: każde zdarzenie z WebSocketu trafia do `next`.
const subscription = client.subscribe({ query: BID_PLACED, variables: { auctionId: "1" } }).subscribe({
  next: (result) => console.log("event:", JSON.stringify(result.data)),
  error: (error) => console.log("error:", error.message),
});

// Chwila na nawiązanie połączenia, bo zdarzenia sprzed subskrypcji nie wracają.
await sleep(500);

// Mutacje idą przez HTTP: dwie oferty na aukcji 1 i jedna na aukcji 2.
await client.mutate({ mutation: PLACE_BID, variables: { auctionId: "1", amount: 130 } });
await client.mutate({ mutation: PLACE_BID, variables: { auctionId: "2", amount: 350 } });
await client.mutate({ mutation: PLACE_BID, variables: { auctionId: "1", amount: 140 } });

await sleep(300);
subscription.unsubscribe();
process.exit(0);
