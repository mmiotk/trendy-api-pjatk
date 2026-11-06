import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { useDisableIntrospection } from "@graphql-yoga/plugin-disable-introspection";
import { usePersistedOperations } from "@graphql-yoga/plugin-persisted-operations";
import { useServer } from "graphql-ws/use/ws";
import { createYoga, type Plugin } from "graphql-yoga";
import { WebSocketServer } from "ws";
import { createDb } from "./db.ts";
import { createContext, type Context } from "./context.ts";
import { aliasRule, costRule, depthRule } from "./rules.ts";
import { schema } from "./schema.ts";

// Baza powstaje raz, przy starcie serwera.
const db = createDb();

// Reguły limitów działają w walidacji, czyli przed wykonaniem i przed zbudowaniem kontekstu.
const limits: Plugin = {
  onValidate: ({ addValidationRule }) => {
    addValidationRule(depthRule(6));
    addValidationRule(aliasRule(15));
    addValidationRule(costRule(100));
  },
};

// W produkcji introspekcja jest wyłączona, a serwer przyjmuje tylko operacje z pliku.
const production = process.env.NODE_ENV === "production";
const operations: Record<string, string> = JSON.parse(readFileSync("operations.json", "utf8"));
const notAllowed = { message: "Operation is not on the allowlist", extensions: { code: "OPERATION_NOT_ALLOWED", http: { status: 403 } } };

const yoga = createYoga<{}, Context>({
  schema,
  // Przy WebSockecie `request` nie istnieje, więc subskrypcje działają bez tokenu.
  context: ({ request }) => createContext(db, request?.headers.get("authorization") ?? null),
  plugins: [
    limits,
    ...(production
      ? [
          useDisableIntrospection(),
          usePersistedOperations({
            // Klient wysyła klucz operacji z pliku, a nie jej tekst.
            getPersistedOperation: (key) => operations[key] ?? null,
            // Domyślnie tekst spoza listy to błąd bez statusu 403, więc wszystkie trzy odmowy dostają go jawnie.
            customErrors: { persistedQueryOnly: notAllowed, notFound: notAllowed, keyNotFound: notAllowed },
          }),
        ]
      : []),
  ],
  // GraphiQL łączy się z subskrypcjami przez WebSocket (domyślnie użyłby SSE).
  graphiql: { subscriptionsProtocol: "WS" },
});
const server = createServer(yoga);

// WebSocket na tym samym porcie i pod tym samym adresem co HTTP; wzór z dokumentacji Yogi.
const wsServer = new WebSocketServer({ server, path: yoga.graphqlEndpoint });
useServer(
  {
    // `execute` i `subscribe` biorą funkcje z `rootValue`, czyli te z Yogi.
    execute: (args: any) => args.rootValue.execute(args),
    subscribe: (args: any) => args.rootValue.subscribe(args),
    onSubscribe: async (ctx, _id, params) => {
      // `getEnveloped` daje funkcje Yogi z podłączonymi wtyczkami: parse, validate, contextFactory, execute, subscribe.
      const { schema, execute, subscribe, contextFactory, parse, validate } = yoga.getEnveloped({
        ...ctx,
        req: ctx.extra.request,
        socket: ctx.extra.socket,
        params,
      });
      const args = {
        schema,
        operationName: params.operationName,
        document: parse(params.query),
        variableValues: params.variables,
        contextValue: await contextFactory(),
        rootValue: { execute, subscribe },
      };
      // Błędy walidacji wracają do klienta bez uruchamiania subskrypcji.
      const errors = validate(args.schema, args.document);
      if (errors.length) return errors;
      return args;
    },
  },
  wsServer,
);

const port = Number(process.env.PORT ?? 4050);
server.listen(port, () => {
  console.log(`Auctions GraphQL on http://localhost:${port}/graphql`);
});
