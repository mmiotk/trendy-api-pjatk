import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { buildSubgraphSchema } from "@apollo/subgraph";
import { parse } from "graphql";
import { createYoga } from "graphql-yoga";

const items = [
  { id: "1", title: "Vintage typewriter", description: "Underwood No. 5 from 1928, restored, with a new ribbon and the original wooden case." },
  { id: "2", title: "Mechanical watch", description: "Hand-wound watch from 1962 with a steel case, serviced last year." },
  { id: "3", title: "Oak writing desk", description: "Solid oak desk with three drawers and a green leather top, 120 cm wide." },
  { id: "4", title: "First edition atlas", description: "World atlas printed in 1954, 64 colour maps, light wear on the spine." },
  { id: "5", title: "Film camera", description: "35 mm rangefinder camera with a 50 mm lens and a leather strap." },
  { id: "6", title: "Brass telescope", description: "Three-draw brass telescope from the 1900s with a wooden tripod." },
];

const resolvers = {
  Query: {
    item: (_parent: unknown, args: { id: string }) => items.find((item) => item.id === args.id) ?? null,
    items: () => items,
  },
  Item: {
    // Brama pyta o przedmiot po samym `id` (reprezentacja z `@key`); subgraf zwraca pełny obiekt.
    __resolveReference: (reference: { id: string }) => items.find((item) => item.id === reference.id),
  },
};

const yoga = createYoga({
  schema: buildSubgraphSchema([{ typeDefs: parse(readFileSync("schema/catalog.graphql", "utf8")), resolvers }]),
  // Każde zapytanie, które dociera do subgrafu, trafia do logu: widać, co robi brama.
  plugins: [{ onParams: ({ params }) => console.log("catalog <-", params.query?.replace(/\s+/g, " "), JSON.stringify(params.variables)) }],
});

const port = Number(process.env.PORT ?? 4061);
createServer(yoga).listen(port, () => console.log(`catalog subgraph on http://localhost:${port}/graphql`));
