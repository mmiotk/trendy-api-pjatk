import { parse, validate, execute } from "graphql";
import { createContext } from "./context.ts";
import { createDb } from "./db.ts";
import { schema } from "./schema.ts";

// Dokument można podać w argumencie, domyślnie to proste zapytanie o dwie gry.
const source = process.argv[2] ?? "{ games(limit: 2) { title publisher { name } } }";

// Etap 1: parsowanie zamienia tekst na drzewo składniowe (AST).
const document = parse(source);
console.log("parse:", document.definitions.length, "definition");

// Etap 2: walidacja porównuje drzewo ze schematem; pusta lista to brak błędów.
const errors = validate(schema, document);
console.log("validate:", errors.length, "errors");
if (errors.length > 0) {
  console.log(errors.map((error) => error.message));
  process.exit(1);
}

// Etap 3: wykonanie wywołuje resolver dla każdego pola. Tu nie ma serwera HTTP.
// Kontekst budujemy ręcznie, tak jak robi to Yoga przy każdym żądaniu.
const contextValue = createContext(createDb());
const result = await execute({ schema, document, contextValue });
console.log("execute:", JSON.stringify(result));
console.log("SQL statements:", contextValue.stats.sql);
