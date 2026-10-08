#!/usr/bin/env node
// buildSchema() both parses AND type-checks the SDL (unknown types, wrong
// field references, etc. throw here) — the same role graphql-js plays
// inside every real GraphQL server, used here with no server at all.
import { readFileSync } from "node:fs";
import { buildSchema } from "graphql";

const sdl = readFileSync("contracts/graphql/weather.graphql", "utf8");
const schema = buildSchema(sdl);
const queryFields = Object.keys(schema.getQueryType()?.getFields() ?? {});
console.log(`SDL is valid. Query fields: ${queryFields.join(", ")}`);
