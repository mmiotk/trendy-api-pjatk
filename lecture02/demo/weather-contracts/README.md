# Weather Stations API — projekt referencyjny (wykład 02)

„Gotowa wersja" aplikacji budowanej na żywo na wykładzie 02. Kontrakt (OpenAPI 3.1, GraphQL SDL,
Protocol Buffers, AsyncAPI) jako źródło prawdy dla API odczytów ze stacji pogodowych — stacje, czujniki,
odczyty. Motyw inny niż lab 02 („Rowery miejskie") i tutorial 02 („Domowa biblioteczka").

## Wymagania

Node.js ≥ 24 (sprawdzone na 24.18.0), npm. `npm install` ciągnie też CLI-e kontraktów (Prism, buf,
AsyncAPI CLI) — pierwsza instalacja trwa dłużej niż w wykładzie 01 (1441 pakietów przy instalacji
z `package-lock.json` przez `npm ci` albo `npm install`, głównie przechodnie zależności tych CLI-i;
przy budowaniu projektu od zera, pakiet po pakiecie, liczba wychodzi inna, zmierzono 1545;
`23 vulnerabilities` w `npm audit` pochodzą z tych samych, niekrytycznych dla lokalnego użycia
narzędzi deweloperskich).

Wszystko instaluje jeden `npm install`, bez `--legacy-peer-deps` i bez narzędzi spoza npm. Układ
narzędzi jest taki sam jak w labie 02: TypeScript 7 w `devDependencies`, generator typów przez `npx`,
`oasdiff` z pakietu `@oasdiff-js/oasdiff-js`.

## Zweryfikowane wersje (2026-09-25)

| Narzędzie | Wersja | Rola |
|---|---|---|
| Node.js | 24.18.0 | runtime, natywne usuwanie typów TS |
| Express | 5.2.1 | serwer REST |
| TypeScript | 7.0.2 | `tsc --noEmit` (natywny kompilator, jak w wykładzie 01) |
| express-openapi-validator | 5.6.2 | walidacja żądań/odpowiedzi wg kontraktu |
| openapi-typescript | 7.13.0 przez `npx` | generowanie typów z OpenAPI, z własnym TypeScriptem 5.9.3 |
| @stoplight/prism-cli | 5.16.0 | atrapa (*mock*) z kontraktu |
| graphql | 17.0.2 | `buildSchema` — walidacja SDL |
| @bufbuild/buf | 1.73.0 | `buf lint`, `buf breaking` dla `.proto` |
| @asyncapi/cli | 6.2.0 | `asyncapi validate` |
| ajv | 8.20.0 | walidacja JSON Schema (test zgodności, formaty) |
| protobufjs | 8.8.0 | encode/decode Protobuf bez `protoc` |
| avsc | 5.7.9 | encode/decode Avro |
| oasdiff | 1.15.0 przez `@oasdiff-js/oasdiff-js` 1.0.0 | wykrywanie zmian łamiących OpenAPI 3.1 |

### Dlaczego generator przez `npx`, a nie w `devDependencies`

`openapi-typescript` buduje wynik przez klasyczne Compiler API TypeScriptu (`ts.factory`) i deklaruje
peer dependency `typescript@^5.x`. Sprawdzone bezpośrednio:

- `npm install -D openapi-typescript` obok `typescript@7.0.2` kończy się `ERESOLVE unable to resolve
  dependency tree` (`peer typescript@"^5.x" from openapi-typescript@7.13.0`);
- wymuszenie `--legacy-peer-deps` instaluje pakiet, ale `typescript@7.0.2` eksportuje wyłącznie
  `{ version, versionMajorMinor }`, więc generator pada na `TypeError: Cannot read properties of
  undefined (reading 'createKeywordTypeNode')`.

`npm run generate` woła więc `npx --yes openapi-typescript@7.13.0`: `npx` instaluje generator w
osobnym katalogu podręcznym razem z jego własnym `typescript@5.9.3`. Projekt zostaje przy TypeScripcie 7,
a wygenerowany plik jest identyczny (273 linie) jak przy starszym układzie z TypeScriptem 5 w projekcie.

### Dlaczego `@oasdiff-js/oasdiff-js`, a nie `openapi-diff`

npm-owy pakiet `openapi-diff` (OpenAPITools, ten sam, którego używa Gough w *Mastering API
Architecture*) **odmawia obsługi OpenAPI 3.1**: `Unsupported OpenAPI version: 3.1.0. Swagger Parser only
supports versions 3.0.0, 3.0.1, 3.0.2, 3.0.3`. Oficjalny `oasdiff` to binarka Go (wydania na GitHubie),
a pakiet `oasdiff` w npm to atrapa. `@oasdiff-js/oasdiff-js` jest nakładką społeczności, nie projektem autorów
`oasdiff`: instaluje oficjalną binarkę dla danej platformy jako zależność opcjonalną
(`@oasdiff-js/oasdiff-linux-x64` itd.) i udostępnia polecenie `oasdiff`. Wybrany, bo na komputerach w sali
wystarcza jeden `npm install`, bez `curl`, `brew` i uprawnień do katalogów systemowych. Binarka jest
częścią pakietu npm: pakiet nie ma skryptu instalacyjnego, a polecenie `oasdiff` uruchamia plik z
`node_modules` bez dostępu do sieci.

Koszty tego wyboru, zapisane wprost:

- `@oasdiff-js/oasdiff-js` 1.0.0 niesie `oasdiff` 1.15.0, starszy od wydań binarki na GitHubie. Na
  kontraktach tego projektu wynik jest taki sam jak z binarki 1.32.1: 4 błędy i 1 ostrzeżenie;
- to następca przestarzałego pakietu `oasdiff-js` 2.0.4 (ta sama binarka 1.15.0, ten sam wynik); demo
  i lab 02 używają tego samego pakietu;
- przy kodzie niezerowym nakładka dopisuje na końcu linię `Command failed: …/oasdiff breaking …`.

## Instalacja i uruchomienie

```bash
npm install
npm run typecheck        # tsc --noEmit
npm run dev               # serwer: node --watch src/server.ts, http://localhost:3000
```

W kolejnych terminalach (przy uruchomionym `npm run dev`):

```bash
npm run mock              # segment 1: atrapa Prism z contracts/openapi/weather.v1.yaml, port 4010
npm run mock:client       # segment 1: klient napisany przeciw atrapie
npm run conformance       # segment 3: test zgodności serwer <-> kontrakt (ajv, niezależnie od walidatora serwera)
npm run client:v1         # segment 5: "stary" klient (temperatureCelsius)
npm run client:v2         # segment 5: "nowy" klient (temperatureValue+unit)
npm run evolution         # segment 5: wszystkie 4 kombinacje stary/nowy klient x serwer naraz
                          # adresy: V1_BASE_URL (domyślnie http://localhost:3000/v1) i V2_BASE_URL (domyślnie http://localhost:3000/v2)
npm run formats           # segment 8: JSON vs Protobuf vs Avro, ta sama ewolucja w trzech formatach
npm run contracts:check   # segment 7: symulacja CI — diff OpenAPI (oasdiff z @oasdiff-js/oasdiff-js) + buf breaking + asyncapi validate + graphql SDL
npm run generate          # regeneruje src/generated/weather.v1.d.ts z contracts/openapi/weather.v1.yaml
```

`contracts:check` domyślnie porównuje **v1.1 -> v2 (zmiana łamiąca, exit 1)**. Żeby zobaczyć parę
zgodną (exit 0):

```bash
OASDIFF_BASE=contracts/openapi/weather.v1.yaml OASDIFF_NEXT=contracts/openapi/weather.v1.1.yaml \
BUF_BASE=v1 BUF_NEXT=v1.1 \
npm run contracts:check
```

Wynik każdej kontroli (`PASS` albo `FAIL` z kodem wyjścia) i komunikaty narzędzi wypisuje samo
`npm run contracts:check`.

AsyncAPI CLI 6.2.0 wypisuje na stderr cztery nieszkodliwe ostrzeżenia (`NODE_ENV`, brak katalogu
konfiguracji). Skrypt `scripts/contracts-check.mjs` odfiltrowuje tylko te cztery linie; prawdziwe
błędy walidacji zostają widoczne.

`npm run evolution` łączy się domyślnie z jednym serwerem na porcie 3000 (`/v1` i `/v2`). Inne adresy
ustawiają zmienne środowiskowe, np. dla dwóch serwerów na portach 3301 i 3302:

```bash
PORT=3301 npm run dev
PORT=3302 npm run dev     # w drugim terminalu
V1_BASE_URL=http://localhost:3301/v1 V2_BASE_URL=http://localhost:3302/v2 npm run evolution
```

## Struktura

```
contracts/
  openapi/
    weather.v1.yaml        design-first kontrakt (segment 0) — atrapa, typy, walidacja serwera opierają się na tym pliku
    weather.v1.1.yaml       segment 5: + pole opcjonalne qualityFlag (zmiana zgodna)
    weather.v2.yaml          segment 5: temperatureCelsius -> temperatureValue+unit, unit wymagane (zmiana łamiąca)
  graphql/weather.graphql    ta sama operacja "latestReading" w SDL (segment 4)
  proto/                     ta sama operacja jako usługa gRPC (segment 4) — moduł buf (buf.yaml, buf lint)
  proto-evolution/            v1/v1.1/v2 migawki .proto WYŁĄCZNIE do demonstracji `buf breaking` (segment 7) — nie są częścią modułu w proto/
  asyncapi/weather-events.yaml  ta sama operacja jako zdarzenie "nowy odczyt" (segment 4)
src/
  data.ts                    typy + dane w pamięci (stations, readings)
  server.ts                   Express 5 — /v1 (weather.v1.1.yaml, stan *deprecated*: nagłówki Deprecation, Sunset, Link) i /v2 (weather.v2.yaml) w jednym procesie (segment 6)
  generated/weather.v1.d.ts    wygenerowane przez openapi-typescript (segment 2) — nie edytować ręcznie
  mock-client.ts               segment 1: klient przeciw atrapie Prism
  validate-conformance.ts       segment 3: test zgodności serwer <-> kontrakt (trzecia droga)
  client-v1.ts, client-v2.ts    segment 5: "stary"/"nowy" klient
  evolution-demo.ts             segment 5: wszystkie 4 kombinacje naraz
  formats-demo.ts               segment 8: JSON/Protobuf/Avro, ta sama ewolucja w trzech formatach
scripts/
  contracts-check.mjs           segment 7: symulacja CI (oasdiff + buf breaking + asyncapi validate + graphql SDL)
  validate-graphql-sdl.mjs       wywoływany przez contracts-check.mjs
```

## Punkty końcowe

| Metoda i ścieżka | Kontrakt | Rola |
|---|---|---|
| `GET /v1/stations`, `GET /v1/stations/:id` | `weather.v1.1.yaml` | katalog stacji |
| `GET /v1/stations/:id/readings/latest` | `weather.v1.1.yaml` | najnowszy odczyt — `temperatureCelsius` + opcjonalny `qualityFlag` |
| `POST /v1/stations/:id/readings` | `weather.v1.1.yaml` | nowy odczyt — wymaga `temperatureCelsius` |
| `GET /v2/stations`, `GET /v2/stations/:id` | `weather.v2.yaml` | katalog stacji (identyczny kształt) |
| `GET /v2/stations/:id/readings/latest` | `weather.v2.yaml` | najnowszy odczyt — `temperatureValue` + `unit` (bez `temperatureCelsius`) |
| `POST /v2/stations/:id/readings` | `weather.v2.yaml` | nowy odczyt — wymaga `temperatureValue` i `unit` |

Wersja `/v1` jest w stanie *deprecated* (przestarzała, ale działa): każda jej odpowiedź, także `400` z walidatora, niesie nagłówki
`Deprecation`, `Sunset` i `Link`; odpowiedzi `/v2` ich nie mają. Nagłówki podgląda się przez
`curl -s -D - -o /dev/null http://localhost:3000/v1/stations`, bo `curl -I` wysyła `HEAD`, a ten daje `405`.
