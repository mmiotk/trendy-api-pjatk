import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { schema } from "./schema.ts";

// `createYoga` buduje z schematu obsługę żądań HTTP; GraphiQL jest wbudowany i działa pod `/graphql`.
// Domyślnie Yoga ukrywa przed klientem szczegóły błędów serwera (`maskedErrors`).
// Tylko na potrzeby nauki: pokazuje oryginalne komunikaty błędów.
const yoga = createYoga({ schema, maskedErrors: false });
// Obiekt Yogi jest funkcją obsługującą żądania, więc można go podać serwerowi `node:http` wprost.
const server = createServer(yoga);

server.listen(4000, () => {
  console.log("Festival GraphQL on http://localhost:4000/graphql");
});
