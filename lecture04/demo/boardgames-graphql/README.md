# Boardgames GraphQL: wykonanie, błędy i wydajność

Mały serwer GraphQL o bibliotece gier planszowych: gry, wydawnictwa, egzemplarze, wypożyczenia i recenzje. Schemat leży
w jednym pliku SDL, dane w `node:sqlite` (baza `:memory:` zakładana przy starcie), serwer to GraphQL Yoga na
`node:http`. Projekt jest stanem końcowym wykładu 04; scenariusz prowadzącego (`../PROWADZACY.md`) buduje go segment po
segmencie, w kolejności slajdów.

Wymagania: Node.js 24 (uruchamia pliki `.ts` bez kompilacji; `node:sqlite` jest wbudowany), npm. GraphiQL pod
`/graphql` ładuje swoje pliki z `unpkg.com`, więc wymaga internetu.

## Pliki

| Plik | Zawartość |
|---|---|
| `schema/boardgames.graphql` | cały schemat w SDL: `Query`, `Mutation`, typy, `input`, unia wyników |
| `src/db.ts` | baza `node:sqlite`: tabele i dane zakładane przy starcie |
| `src/context.ts` | kontekst żądania: dostęp do bazy, licznik instrukcji SQL, loadery |
| `src/loaders.ts` | DataLoadery: wydawnictwa, recenzje, egzemplarze |
| `src/schema.ts` | `createSchema({ typeDefs, resolvers })` |
| `src/server.ts` | `createServer` z `node:http` i `createYoga`, wtyczka z licznikiem SQL, port 4040 |
| `src/execute.ts` | `parse` → `validate` → `execute` bez serwera HTTP |
| `src/objectSchema.ts` | fragment schematu z obiektów `GraphQLObjectType` i `printSchema` |
| `src/mock.ts` | atrapa ze schematu (`addMocksToSchema`) |
| `src/inProcess.ts` | operacja wykonana funkcją `graphql()` na prawdziwym schemacie |
| `src/clientFetch.ts` | klient `fetch` |
| `src/clientApollo.ts` | klient `@apollo/client` w Node, bez Reacta |
| `src/clientCache.ts` | pamięć podręczna Apolla: normalizacja, `cache.modify`, `writeQuery`, `clearStore` |
| `src/diagram.ts` | wynik introspekcji zamieniony na diagram Mermaid, lista węzłów osieroconych |

## Polecenia

```bash
npm ci                          # instalacja z package-lock.json
npm run dev                     # serwer z restartem po zmianie src/ i schema/, http://localhost:4040/graphql
npm run typecheck               # tsc --noEmit
node src/execute.ts             # skrypty działają bez serwera, poza klientami
node src/clientApollo.ts        # klienty wymagają działającego serwera
```

Zapytania wpisuje się w GraphiQL; ich treść jest w `../PROWADZACY.md`. Baza jest w pamięci, więc każdy restart serwera
(także ten po zapisaniu pliku w `npm run dev`) przywraca stan początkowy.
