import { createServer } from "node:http";
import { createYoga, type Plugin } from "graphql-yoga";
import { createDb } from "./db.ts";
import { createContext, type Context } from "./context.ts";
import { schema } from "./schema.ts";

// Baza powstaje raz, przy starcie serwera.
const db = createDb();

// Wtyczka dokleja licznik SQL do pola `extensions` odpowiedzi i wypisuje go w terminalu.
const sqlCounter: Plugin<Context> = {
  onExecute: () => ({
    onExecuteDone: ({ args, result, setResult }) => {
      const sql = args.contextValue.stats.sql;
      console.log("SQL statements in this request:", sql);
      if ("data" in result || "errors" in result) {
        setResult({ ...result, extensions: { sql } });
      }
    },
  }),
};

// Funkcja `context` wykonuje się przy każdym żądaniu i zwraca nowy kontekst.
const yoga = createYoga({
  schema,
  // Maskowanie zawsze, także z NODE_ENV=development: odpowiedź nie dostaje `originalError`.
  maskedErrors: { isDev: false },
  // Funkcja `context` dostaje żądanie HTTP; nagłówek `x-dataloader: off` wyłącza wsadowanie.
  context: ({ request }) => createContext(db, request.headers.get("x-dataloader") !== "off"),
  plugins: [sqlCounter],
});
const server = createServer(yoga);

server.listen(4040, () => {
  console.log("Boardgames GraphQL on http://localhost:4040/graphql");
});
