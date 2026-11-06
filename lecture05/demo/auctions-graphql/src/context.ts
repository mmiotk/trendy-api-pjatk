import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { GraphQLError } from "graphql";

// Zalogowany użytkownik albo null.
export interface Me {
  id: number;
  name: string;
}

// Kontekst powstaje od nowa dla każdego żądania i trafia do każdego resolvera.
export interface Context {
  // Jedna instrukcja SQL z parametrami `?`, wynik jako tablica wierszy.
  query: (sql: string, ...params: SQLInputValue[]) => any[];
  // Użytkownik z tokenu w nagłówku `Authorization`; null, gdy nagłówka nie ma.
  me: Me | null;
}

export function createContext(db: DatabaseSync, authorization: string | null): Context {
  const query: Context["query"] = (sql, ...params) => db.prepare(sql).all(...params);
  // Uwierzytelnianie dzieje się przed GraphQL: nagłówek `Authorization: Bearer <token>` zamienia się na użytkownika.
  let me: Me | null = null;
  if (authorization?.startsWith("Bearer ")) {
    me = query(
      "SELECT u.id, u.name FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.token = ?",
      authorization.slice("Bearer ".length),
    )[0] ?? null;
    // Token, którego nie ma w tabeli, kończy żądanie statusem 401, zanim zadziała jakikolwiek resolver.
    if (!me) {
      throw new GraphQLError("Invalid token", { extensions: { code: "UNAUTHENTICATED", http: { status: 401 } } });
    }
  }
  return { query, me };
}
