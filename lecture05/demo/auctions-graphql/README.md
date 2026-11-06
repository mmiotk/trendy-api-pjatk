# Auctions GraphQL: subskrypcje i bezpieczeństwo

Mały serwer GraphQL o aukcjach internetowych: użytkownicy, przedmioty, aukcje i oferty. Schemat leży w jednym pliku
SDL, dane w `node:sqlite` (baza `:memory:` zakładana przy starcie), serwer to GraphQL Yoga na `node:http`, a
subskrypcje idą przez WebSocket (`graphql-ws`) na tym samym porcie. Projekt jest stanem końcowym wykładu 05;
scenariusz prowadzącego (`../PROWADZACY.md`) buduje go segment po segmencie, w kolejności slajdów. Federacja
(slajdy 10–11) jest w osobnym projekcie `../auctions-federation/`, bo jej biblioteki wymagają `graphql` 16.

Wymagania: Node.js 24 (uruchamia pliki `.ts` bez kompilacji; `node:sqlite` jest wbudowany), npm. GraphiQL pod
`/graphql` ładuje swoje pliki z `unpkg.com`, więc wymaga internetu.

## Pliki

| Plik | Zawartość |
|---|---|
| `schema/auctions.graphql` | cały schemat w SDL: `Query`, `Mutation`, `Subscription`, typy, dyrektywy `@cost` i `@auth`, pole `currentPrice` z `@deprecated` |
| `operations.json` | allowlista: operacja `auctionById`, jedyna, którą serwer w produkcji przyjmuje |
| `src/db.ts` | baza `node:sqlite`: tabele i dane zakładane przy starcie (trzech użytkowników, tokeny, dwa przedmioty, dwie aukcje, dwie oferty) |
| `src/context.ts` | kontekst żądania: funkcja `query` do bazy i `me` z tokenu |
| `src/schema.ts` | `createSchema`, resolvery, `PubSub` i filtr subskrypcji |
| `src/rules.ts` | reguły walidacji: głębokość, aliasy, koszt (bez rozwijania fragmentów) |
| `src/directives.ts` | transformacja schematu: `@auth` |
| `src/pipes.ts` | pipes: logical, access, ownership |
| `src/server.ts` | Yoga z wtyczką limitów i wtyczkami produkcyjnymi, WebSocket przez `graphql-ws` (wzór z dokumentacji Yogi), port 4050 |
| `src/clientSubscribe.ts` | klient `@apollo/client` w Node z `split`: mutacje przez HTTP, subskrypcja przez WebSocket |
| `src/attack.ts` | zapytania na granicy limitów i tuż za nią: głębokość 6 i 7, 15 i 16 aliasów |

## Polecenia

```bash
npm ci                          # instalacja z package-lock.json
npm run dev                     # serwer z restartem po zmianie src/ i schema/, http://localhost:4050/graphql
npm run typecheck               # tsc --noEmit
NODE_ENV=production npm start   # introspekcja wyłączona, przez HTTP tylko operacje z operations.json
node src/clientSubscribe.ts     # klient z split (wymaga działającego serwera)
node src/attack.ts              # granice limitów (wymaga serwera w trybie deweloperskim)
```

Zapytania wpisuje się w GraphiQL; ich treść jest w `../PROWADZACY.md`. Port zmienia zmienna `PORT`. Baza jest w
pamięci, więc każdy restart serwera (także ten po zapisaniu pliku w `npm run dev`) przywraca stan początkowy.
Tokeny testowe: `maria-token` (Maria, sprzedawca aukcji 1 i 2), `nina-token` (Nina, licytuje). Oscar licytuje, ale nie ma
tokenu.
