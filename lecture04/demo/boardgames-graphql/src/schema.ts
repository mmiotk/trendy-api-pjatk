import { readFileSync } from "node:fs";
import { createSchema } from "graphql-yoga";
import type { Context } from "./context.ts";

const typeDefs = readFileSync("schema/boardgames.graphql", "utf8");

// Kolumny w snake_case dostają aliasy, więc wiersz ma pola o nazwach z schematu.
const GAME_COLUMNS =
  "id, title, year, min_players AS minPlayers, max_players AS maxPlayers, publisher_id AS publisherId";

const resolvers = {
  Query: {
    // Resolver ma cztery parametry: (parent, args, context, info).
    // Dla pola z korzenia `parent` jest pusty, a `args` niesie argumenty zapytania.
    games: (_parent: unknown, args: { limit?: number }, ctx: Context) =>
      ctx.query(`SELECT ${GAME_COLUMNS} FROM games LIMIT ?`, args.limit ?? 100),
    game: (_parent: unknown, args: { id: string }, ctx: Context) =>
      ctx.query(`SELECT ${GAME_COLUMNS} FROM games WHERE id = ?`, args.id)[0] ?? null,
    loans: (_parent: unknown, _args: unknown, ctx: Context) => ctx.query("SELECT id, borrower FROM loans"),
  },
  Mutation: {
    borrowCopy: (_parent: unknown, args: { input: { gameId: string; borrower: string } }, ctx: Context) => {
      const { gameId, borrower } = args.input;
      const game = ctx.query("SELECT title FROM games WHERE id = ?", gameId)[0];
      if (!game) {
        // Domyślny rozpoznawacz typu unii czyta pole `__typename` ze zwróconego obiektu.
        return { __typename: "GameNotFound", gameId, message: `Game ${gameId} does not exist` };
      }
      // Pierwszy egzemplarz tej gry, który nie ma wypożyczenia.
      const copy = ctx.query(
        `SELECT id FROM copies c
         WHERE game_id = ? AND NOT EXISTS (SELECT 1 FROM loans l WHERE l.copy_id = c.id)
         LIMIT 1`,
        gameId,
      )[0];
      if (!copy) {
        return { __typename: "CopyUnavailable", gameId, message: `All copies of ${game.title} are borrowed` };
      }
      // RETURNING zwraca wstawiony wiersz bez dodatkowego SELECT-a.
      const loan = ctx.query("INSERT INTO loans (copy_id, borrower) VALUES (?, ?) RETURNING id, borrower", copy.id, borrower)[0];
      return { __typename: "BorrowCopySuccess", loan, copy: { id: copy.id, available: false } };
    },
  },
  Game: {
    // Pola `id`, `title`, `year` itd. nie mają resolvera: działa resolver domyślny,
    // który zwraca `parent[nazwaPola]`. Relacja do wydawnictwa wymaga własnego.
    publisher: (parent: { publisherId: number }, _args: unknown, ctx: Context) =>
      ctx.loaders.publisherById.load(parent.publisherId),
    reviews: (parent: { id: number }, _args: unknown, ctx: Context) =>
      ctx.loaders.reviewsByGameId.load(parent.id),
    copies: (parent: { id: number }, _args: unknown, ctx: Context) =>
      ctx.loaders.copiesByGameId.load(parent.id),
  },
};

export const schema = createSchema<Context>({ typeDefs, resolvers });
