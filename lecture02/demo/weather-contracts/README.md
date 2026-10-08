# Weather Stations API: kontrakt jako źródło prawdy

Najnowszy odczyt stacji pogodowej opisany kontraktem OpenAPI 3.1 i tymi samymi danymi w GraphQL SDL,
Protocol Buffers i AsyncAPI. Z kontraktu powstają atrapa, typy TypeScriptu i walidacja ruchu w serwerze;
porównanie dwóch wersji kontraktu wykrywa zmianę łamiącą.

Wymagania: Node.js 24 (uruchamia pliki `.ts` bez kompilacji), npm. Instalacja: `npm ci`.

## Pliki

| Plik | Zawartość |
|---|---|
| `contracts/openapi/weather.v1.yaml` | kontrakt 1.1.0: odczyt (`GET`) i zapis (`POST`) pod `/v1` |
| `contracts/openapi/weather.v2.yaml` | kontrakt 2.0.0 pod `/v2`: `temperatureValue` i `unit` zamiast `temperatureCelsius` |
| `contracts/graphql/weather.graphql` | ta sama operacja w GraphQL SDL |
| `contracts/proto/` | moduł `buf`: `buf.yaml` i `weather/v1/weather.proto` |
| `contracts/proto-evolution/v1/`, `v2/` | migawki `.proto` wydanych wersji, tylko do `buf breaking` |
| `contracts/asyncapi/weather-events.yaml` | ta sama operacja jako zdarzenie |
| `src/generated/weather.v1.d.ts` | typy wygenerowane z kontraktu (nie edytować) |
| `src/server.ts` | Express 5: `/v1` i `/v2`, każda wersja z własnym walidatorem; `/v1` z nagłówkami wycofania |
| `src/client.ts` | klient na typach z kontraktu (`BASE_URL`, domyślnie atrapa) |
| `src/conformance.ts` | test zgodności odpowiedzi serwera z kontraktem (`ajv`), kod wyjścia 0 albo 1 |
| `src/sdl.ts` | sprawdzenie SDL przez `buildSchema` |
| `src/formats.ts` | ten sam rekord w JSON, Protobuf i Avro, przed dodaniem pola i po nim |

## Polecenia

```bash
npm run mock                                   # atrapa Prism z weather.v1.yaml, port 4010
npm run client                                 # klient na atrapie
npm run generate                               # typy z kontraktu (openapi-typescript 7.13.0 przez npx)
npm run typecheck                              # tsc --noEmit
npm run dev                                    # serwer, port 3000
BASE_URL=http://localhost:3000/v1 npm run client
npm run conformance                            # serwer musi działać
npm run sdl
npx buf lint contracts/proto
npx asyncapi validate contracts/asyncapi/weather-events.yaml
npm run breaking                               # oasdiff + buf breaking: v1 -> v2, kod wyjścia 1
npm run formats
```

Generator typów działa przez `npx` z własnym TypeScriptem 5.9.3, bo deklaruje zależność peer
`typescript@^5.x`, a projekt używa TypeScriptu 7. `oasdiff` przychodzi z pakietu `@oasdiff-js/oasdiff-js`,
bo npm-owy `openapi-diff` nie czyta OpenAPI 3.1.

Wersje: Node 24.18.0, Express 5.2.1, TypeScript 7.0.2, `express-openapi-validator` 5.6.2, Prism 5.16.0,
graphql 17.0.2, buf 1.73.0, AsyncAPI CLI 6.2.0, oasdiff 1.15.0, ajv 8.20.0, protobufjs 8.8.0, avsc 5.7.9.
