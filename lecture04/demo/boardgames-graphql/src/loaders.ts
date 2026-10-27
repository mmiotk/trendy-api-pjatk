import DataLoader from "dataloader";
import type { Context } from "./context.ts";

// Funkcja wsadowa dostaje wszystkie klucze zebrane w jednym przebiegu pętli zdarzeń
// i musi zwrócić tablicę wyników w tej samej kolejności i o tej samej długości.
// Z `batch: false` każde wywołanie `load` uruchamia funkcję wsadową z jednym kluczem.
export function createLoaders(query: Context["query"], batch = true) {
  return {
    publisherById: new DataLoader(async (ids: readonly number[]) => {
      console.log("batch publishers:", ids);
      const marks = ids.map(() => "?").join(", ");
      const rows = query(`SELECT id, name, country FROM publishers WHERE id IN (${marks})`, ...ids);
      // Brakujący klucz dostaje null, a nie undefined.
      return ids.map((id) => rows.find((row) => row.id === id) ?? null);
    }, { batch }),

    reviewsByGameId: new DataLoader(async (gameIds: readonly number[]) => {
      console.log("batch reviews:", gameIds);
      const marks = gameIds.map(() => "?").join(", ");
      const rows = query(
        `SELECT id, game_id AS gameId, rating, comment FROM reviews WHERE game_id IN (${marks})`,
        ...gameIds,
      );
      // Dla każdej gry lista jej recenzji; gra bez recenzji dostaje pustą listę.
      return gameIds.map((gameId) => rows.filter((row) => row.gameId === gameId));
    }, { batch }),

    copiesByGameId: new DataLoader(async (gameIds: readonly number[]) => {
      const marks = gameIds.map(() => "?").join(", ");
      // Egzemplarz jest dostępny, gdy nie ma dla niego wiersza w `loans`.
      const rows = query(
        `SELECT c.id, c.game_id AS gameId,
                NOT EXISTS (SELECT 1 FROM loans l WHERE l.copy_id = c.id) AS available
         FROM copies c WHERE c.game_id IN (${marks})`,
        ...gameIds,
      );
      return gameIds.map((gameId) => rows.filter((row) => row.gameId === gameId));
    }),
  };
}
