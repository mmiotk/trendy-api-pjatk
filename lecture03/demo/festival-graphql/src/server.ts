import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { schema } from "./schema.ts";

// Domyślnie Yoga ukrywa przed klientem szczegóły błędów serwera (`maskedErrors`).
// Tylko na potrzeby nauki: pokazuje oryginalne komunikaty błędów.
const yoga = createYoga({ schema, maskedErrors: false });
const server = createServer(yoga);

server.listen(4000, () => {
  console.log("Festival GraphQL on http://localhost:4000/graphql");
});
