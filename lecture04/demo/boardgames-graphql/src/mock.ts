import { readFileSync } from "node:fs";
import { graphql } from "graphql";
import { createSchema } from "graphql-yoga";
import { addMocksToSchema } from "@graphql-tools/mock";

// Schemat bez żadnych resolverów: sam SDL.
const schema = createSchema({ typeDefs: readFileSync("schema/boardgames.graphql", "utf8") });

// Atrapa dopisuje do każdego pola wartość wygenerowaną z jego typu.
const mockedSchema = addMocksToSchema({
  schema,
  mocks: {
    // Bez tej linii String zwraca "Hello World", a Int losową liczbę.
    String: () => "mock",
    Int: () => 7,
    Game: () => ({ title: "Mock Game" }),
  },
});

const result = await graphql({
  schema: mockedSchema,
  source: "{ games { title year publisher { name } reviews { rating } } }",
});
console.log(JSON.stringify(result));
