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
| `schema/auctions.graphql` | cały schemat w SDL: `Query`, `Mutation` (także `uploadPhoto` ze skalarem `File`), `Subscription`, typy, dyrektywy `@cost` i `@auth` |
| `operations.json` | allowlista: operacje, które serwer w produkcji przyjmuje |
| `src/db.ts` | baza `node:sqlite`: tabele i dane zakładane przy starcie (użytkownicy, tokeny, przedmioty, aukcje, oferty) |
| `src/context.ts` | kontekst żądania: dostęp do bazy, licznik instrukcji SQL, `me` z tokenu |
| `src/schema.ts` | `createSchema`, resolvery (w tym `uploadPhoto`), `PubSub` i filtr subskrypcji |
| `src/rules.ts` | reguły walidacji: głębokość, aliasy, koszt |
| `src/directives.ts` | transformacja schematu: `@auth` i licznik użycia pól z `@deprecated` |
| `src/pipes.ts` | pipes: logical, access, ownership |
| `src/server.ts` | `createServer` z `node:http` (log dostępu), Yoga z wtyczkami (m.in. log nazw operacji), WebSocket przez `graphql-ws`, port 4050 |
| `src/clientSubscribe.ts` | klient `@apollo/client` w Node z `split`: mutacje przez HTTP, subskrypcja przez WebSocket |
| `src/attack.ts` | zapytania odrzucane przed wykonaniem: za głębokie i z setkami aliasów |
| `src/docs.ts` | dokumentacja statyczna `docs/schema.html` wygenerowana ze schematu |

## Polecenia

```bash
npm ci                          # instalacja z package-lock.json
npm run dev                     # serwer z restartem po zmianie src/ i schema/, http://localhost:4050/graphql
npm run typecheck               # tsc --noEmit
NODE_ENV=production npm start   # introspekcja wyłączona, tylko operacje z operations.json
node src/clientSubscribe.ts     # klient z split (wymaga działającego serwera)
node src/attack.ts              # odrzucone zapytania (wymaga serwera w trybie deweloperskim)
node src/docs.ts                # docs/schema.html
```

Zapytania wpisuje się w GraphiQL; ich treść jest w `../PROWADZACY.md`. Port zmienia zmienna `PORT`. Baza jest w
pamięci, więc każdy restart serwera (także ten po zapisaniu pliku w `npm run dev`) przywraca stan początkowy.
Tokeny testowe: `maria-token` (Maria, sprzedawca aukcji 1, 2 i 5), `tom-token` (Tom, sprzedawca aukcji 3, 4 i 6),
`nina-token` (Nina, licytuje). Oscar nie ma tokenu.
