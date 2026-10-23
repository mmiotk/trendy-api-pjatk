# Festival GraphQL: schemat jako model domeny

Mały serwer GraphQL o festiwalu muzycznym: sceny, koncerty, zespoły i soliści. Schemat leży w jednym pliku SDL,
dane w pamięci, serwer to GraphQL Yoga na `node:http`. Projekt jest stanem końcowym wykładu 03; scenariusz
prowadzącego (`../PROWADZACY.md`) buduje go segment po segmencie, w kolejności slajdów.

Wymagania: Node.js 24 (uruchamia pliki `.ts` bez kompilacji), npm. GraphiQL pod `/graphql` ładuje swoje pliki
z `unpkg.com`, więc wymaga internetu.

## Pliki

| Plik | Zawartość |
|---|---|
| `schema/festival.graphql` | cały schemat w SDL: typy, interfejs, unia, `input`, enum, skalar, `Connection`, opisy |
| `src/data.ts` | dane w pamięci: obiekty wskazują na siebie, więc już są grafem |
| `src/schema.ts` | `createSchema({ typeDefs, resolvers })`: SDL z pliku plus najprostsze resolvery |
| `src/datetime.ts` | własny skalar `DateTime` (`serialize`, `coerceInputValue`, `coerceInputLiteral`) |
| `src/server.ts` | `createServer` z `node:http` i `createYoga`, port 4000 |

## Polecenia

```bash
npm ci                # instalacja z package-lock.json
npm run dev           # serwer z restartem po zmianie src/ i schema/, http://localhost:4000/graphql
npm run typecheck     # tsc --noEmit
```

Zapytania wpisuje się w GraphiQL; ich treść jest w `../PROWADZACY.md`.
