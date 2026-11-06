# Auctions federation: dwa subgrafy za jedną bramą

Osobny projekt do slajdów 10–11 wykładu 05. Dwa subgrafy na GraphQL Yoga (`@apollo/subgraph`), kompozycja do
`supergraph.graphql` (`@theguild/federation-composition`) i brama Hive Gateway (`@graphql-hive/gateway`) nad
supergrafem. Projekt ma własny `package.json`, bo `@apollo/subgraph` i `@graphql-hive/gateway` wymagają `graphql` 16,
a główny projekt (`../auctions-graphql/`) używa `graphql` 17. Scenariusz: `../PROWADZACY.md`, segmenty 10–11.

Wymagania: Node.js 24, npm.

## Pliki

| Plik | Zawartość |
|---|---|
| `schema/catalog.graphql` | subgraf `catalog`: `Item` z `@key(fields: "id")`, `Query.item`, `Query.items` |
| `schema/bidding.graphql` | subgraf `bidding`: `Auction` i rozszerzenie `Item` (pole `auctions`) przez ten sam `@key` |
| `src/catalog.ts` | serwer subgrafu `catalog`, port 4061, dane w tablicy |
| `src/bidding.ts` | serwer subgrafu `bidding`, port 4062, dane w tablicy |
| `src/compose.ts` | kompozycja: `schema/*.graphql` → `supergraph.graphql` |
| `supergraph.graphql` | wynik kompozycji (adresy subgrafów zapisane w `join__Graph`) |
| `gateway.config.ts` | konfiguracja bramy: planer z Hive Router i plan zapytania w `extensions` na żądanie |

## Polecenia

```bash
npm ci
npm run catalog        # terminal 1, http://localhost:4061/graphql
npm run bidding        # terminal 2, http://localhost:4062/graphql
npm run compose        # zapisuje supergraph.graphql (adresy z CATALOG_URL i BIDDING_URL, domyślnie porty 4061 i 4062)
npm run gateway        # terminal 3, brama na http://localhost:4060/graphql
npm run typecheck      # tsc --noEmit (bez gateway.config.ts, zob. PROWADZACY.md)
```

Plan zapytania zwraca brama w `extensions.queryPlan`, gdy żądanie ma nagłówek `hive-expose-query-plan: true`.
Każdy subgraf wypisuje w terminalu zapytania, które do niego dotarły.
