import { GraphQLError, Kind } from "graphql";
import type { ConstValueNode } from "graphql";

// Odrzuca wszystko, co nie jest poprawną datą.
// `unknown` wymusza sprawdzenie typu: wartość przychodzi z JSON-a albo z danych i może być czymkolwiek.
function toDate(value: unknown): Date {
  if (typeof value !== "string") {
    // `GraphQLError` to błąd zrozumiały dla GraphQL: klient dostaje jego komunikat zamiast awarii serwera.
    throw new GraphQLError(`DateTime expects a string, got ${typeof value}`);
  }
  // `new Date` nie rzuca błędu dla złego napisu, tylko daje „Invalid Date”, który wykrywa `isNaN`.
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new GraphQLError(`DateTime cannot represent "${value}", expected e.g. 2026-07-10T18:00:00Z`);
  }
  const day = value.slice(0, 10);
  if (new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) {
    throw new GraphQLError(`DateTime cannot represent "${value}", there is no such day in the calendar`);
  }
  return date;
}

export const dateTime = {
  serialize: (value: unknown) => (value instanceof Date ? value : toDate(value)).toISOString(),
  coerceInputValue: (value: unknown) => toDate(value),
  coerceInputLiteral: (ast: ConstValueNode) => {
    // `Kind.STRING` oznacza literał tekstowy w zapytaniu; liczba czy enum zostaną odrzucone.
    if (ast.kind !== Kind.STRING) {
      throw new GraphQLError(`DateTime expects a string literal, got ${ast.kind}`);
    }
    return toDate(ast.value);
  },
};
