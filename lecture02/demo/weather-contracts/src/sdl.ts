import { readFileSync } from "node:fs";
import { buildSchema } from "graphql";

// buildSchema throws on an invalid SDL; no GraphQL server is needed.
const schema = buildSchema(readFileSync("contracts/graphql/weather.graphql", "utf8"));
console.log("SDL is valid. Query fields:", Object.keys(schema.getQueryType()!.getFields()).join(", "));
