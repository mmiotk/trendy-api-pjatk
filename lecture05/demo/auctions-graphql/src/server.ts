import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { useDisableIntrospection } from "@graphql-yoga/plugin-disable-introspection";
import { usePersistedOperations } from "@graphql-yoga/plugin-persisted-operations";
import { GraphQLError } from "graphql";
import { useServer } from "graphql-ws/use/ws";
import { createYoga, type Plugin } from "graphql-yoga";
import { WebSocketServer } from "ws";
import { createDb } from "./db.ts";
import { createContext, stats, type Context } from "./context.ts";
import { aliasRule, costRule, depthRule, MAX_ALIASES, MAX_COST, MAX_DEPTH } from "./rules.ts";
import { schema } from "./schema.ts";

// Baza powstaje raz, przy starcie serwera.
const db = createDb();

// Wtyczka liczy instrukcje SQL żądania: także takiego, które nie dotarło do wykonania.
// Licznik jest wspólny dla procesu, więc wynik jest dokładny dla żądań wysyłanych po kolei.
const before = new WeakMap<Request, number>();
const sqlCounter: Plugin = {
  onRequest: ({ request }) => {
    before.set(request, stats.sql);
  },
  onResponse: ({ request, response }) => {
    const sql = stats.sql - (before.get(request) ?? 0);
    console.log("SQL statements in this request:", sql);
    response.headers.set("x-sql-statements", String(sql));
  },
};

// Reguły limitów działają w walidacji, czyli przed wykonaniem i przed zbudowaniem kontekstu.
const limits: Plugin = {
  onValidate: ({ addValidationRule }) => {
    addValidationRule(depthRule(MAX_DEPTH));
    addValidationRule(aliasRule(MAX_ALIASES));
    addValidationRule(costRule(MAX_COST));
  },
};

// Adres w logu dostępu jest zawsze ten sam, więc wtyczka zapisuje nazwę operacji.
const operationLog: Plugin = {
  onExecute: ({ args }) => {
    console.log("operation:", args.operationName);
  },
};

// W produkcji introspekcja jest wyłączona, a serwer przyjmuje tylko operacje z pliku.
const production = process.env.NODE_ENV === "production";
const operations: Record<string, string> = JSON.parse(readFileSync("operations.json", "utf8"));
const notAllowed = { message: "Operation is not on the allowlist", extensions: { code: "OPERATION_NOT_ALLOWED", http: { status: 403 } } };

const yoga = createYoga<{}, Context>({
  schema,
  // Maskowanie zawsze, także z NODE_ENV=development.
  maskedErrors: { isDev: false },
  // Przy WebSockecie `request` nie istnieje, więc subskrypcje działają bez tokenu (uwierzytelnienie połączenia WS omawia wykład o WebSockecie).
  context: ({ request }) => createContext(db, request?.headers.get("authorization") ?? null),
  plugins: [
    sqlCounter,
    limits,
    operationLog,
    ...(production
      ? [
          useDisableIntrospection(),
          usePersistedOperations({
            // Klient wysyła nazwę operacji z pliku, a nie jej tekst.
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
const server = createServer((req, res) => {
  // Log dostępu w stylu serwera HTTP: metoda, adres, status.
  res.on("finish", () => console.log(req.method, req.url, res.statusCode));
  yoga(req, res);
});

// WebSocket na tym samym porcie i pod tym samym adresem co HTTP.
const wsServer = new WebSocketServer({ server, path: yoga.graphqlEndpoint });
useServer(
  {
    onConnect: () => {
      console.log("WebSocket: client connected");
    },
    // `execute` i `subscribe` biorą funkcje z `rootValue`, czyli te z Yogi (razem z jej wtyczkami).
    execute: (args: any) => args.rootValue.execute(args),
    subscribe: (args: any) => args.rootValue.subscribe(args),
    onSubscribe: async (ctx, _id, params) => {
      const { schema, execute, subscribe, contextFactory, parse, validate } = yoga.getEnveloped({
        ...ctx,
        req: ctx.extra.request,
        socket: ctx.extra.socket,
        params,
      });
      // Wtyczka allowlisty działa tylko na HTTP, więc WebSocket sprawdza klucz operacji osobno.
      const key = (params.extensions?.persistedQuery as { sha256Hash?: string } | undefined)?.sha256Hash;
      const query = production ? operations[key ?? ""] : params.query;
      if (query === undefined) return [new GraphQLError(notAllowed.message, { extensions: { code: notAllowed.extensions.code } })];
      const args = {
        schema,
        operationName: params.operationName,
        document: parse(query),
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
