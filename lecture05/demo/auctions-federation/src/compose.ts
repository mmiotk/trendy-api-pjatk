import { readFileSync, writeFileSync } from "node:fs";
import { composeServices } from "@theguild/federation-composition";
import { parse } from "graphql";

// Kompozycja skleja schematy subgrafów w jeden supergraf i zapisuje, który subgraf jest pod którym adresem.
const result = composeServices([
  {
    name: "catalog",
    typeDefs: parse(readFileSync("schema/catalog.graphql", "utf8")),
    url: process.env.CATALOG_URL ?? "http://localhost:4061/graphql",
  },
  {
    name: "bidding",
    typeDefs: parse(readFileSync("schema/bidding.graphql", "utf8")),
    url: process.env.BIDDING_URL ?? "http://localhost:4062/graphql",
  },
]);

if (result.errors) {
  for (const error of result.errors) console.error(error.message);
  process.exit(1);
}

writeFileSync("supergraph.graphql", result.supergraphSdl);
console.log("supergraph.graphql written");
