import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { createLoaders } from "./loaders.ts";

// Kontekst powstaje od nowa dla każdego żądania i trafia do każdego resolvera.
export interface Context {
  // Jedyna droga do bazy; każde wywołanie to jedna instrukcja SQL.
  query: (sql: string, ...params: SQLInputValue[]) => any[];
  // Licznik instrukcji SQL tego jednego żądania.
  stats: { sql: number };
  // Loadery: nowe w każdym żądaniu, więc ich pamięć nie przecieka między żądaniami.
  loaders: ReturnType<typeof createLoaders>;
}

// Baza żyje w serwerze (jedna na cały proces), licznik w żądaniu.
// `batch` przechodzi do loaderów: false wyłącza wsadowanie w tym jednym żądaniu.
export function createContext(db: DatabaseSync, batch = true): Context {
  const stats = { sql: 0 };
  const query: Context["query"] = (sql, ...params) => {
    stats.sql += 1;
    // Z LOG_SQL=1 każda instrukcja trafia do terminala.
    if (process.env.LOG_SQL) console.log("SQL:", sql.replace(/\s+/g, " "), params);
    return db.prepare(sql).all(...params);
  };
  return { stats, query, loaders: createLoaders(query, batch) };
}
