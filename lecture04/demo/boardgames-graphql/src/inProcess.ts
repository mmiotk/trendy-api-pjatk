import { graphql } from "graphql";
import { createContext } from "./context.ts";
import { createDb } from "./db.ts";
import { schema } from "./schema.ts";

// Ta sama operacja co przez HTTP, ale wywołana funkcją: bez portu, JSON-a i przeglądarki.
// Zmienne podajemy jako obiekt, a kontekst budujemy tak jak w serwerze.
const contextValue = createContext(createDb());

const result = await graphql({
  schema,
  contextValue,
  source: `
    mutation Borrow($input: BorrowCopyInput!) {
      borrowCopy(input: $input) {
        __typename
        ... on BorrowCopySuccess { loan { id borrower } }
        ... on CopyUnavailable { message }
      }
    }
  `,
  variableValues: { input: { gameId: "2", borrower: "dave" } },
});
console.log(JSON.stringify(result));
console.log("SQL statements:", contextValue.stats.sql);
