# Parcel Lockers gRPC: usługi skrytek i przesyłek

Projekt referencyjny wykładu 06 (RPC i podstawy gRPC): dwie usługi gRPC o paczkomatach, zbudowane krok po kroku w
`../PROWADZACY.md`. `LockerService` (porty 50061 i 50063) zwraca paczkomat i rezerwuje skrytkę, `ShipmentService` (port 50062)
tworzy przesyłkę i woła `LockerService` przez stub klienta. Dane leżą w pamięci procesu (`src/data.ts`), więc każdy restart
serwera przywraca stan początkowy.

Wymagania: Node.js 24 (uruchamia pliki `.ts` bez kompilacji), npm 11, opcjonalnie `grpcurl` 1.9.4 (`~/.local/bin/grpcurl`).
Wersje bibliotek są przypięte: `@grpc/grpc-js` 1.14.6, `@grpc/proto-loader` 0.8.1, `@grpc/reflection` 1.0.4, `protobufjs` 7.6.6,
`google-proto-files` 6.1.0 (pliki `google/rpc/*.proto` dla `BadRequest`; ładuje je `errors.ts` przez `proto-loader`), TypeScript 7.0.2 (tylko `tsc --noEmit`).

## Uruchomienie

```bash
npm ci
npm run generate        # typy z plików .proto do src/generated/ (katalog w .gitignore)
npm run typecheck       # tsc --noEmit
npm run locker          # LockerService na 50061 (restart po zmianie src/ i proto/)
PORT=50063 npm run locker   # druga instancja
npm run shipment        # ShipmentService na 50062 (wymaga działającego LockerService na 50061)
node src/client.ts      # klient usługi skrytek, błędy z kodami statusu
node src/shipmentClient.ts
node src/balance.ts     # round_robin na dwóch instancjach (50061 i 50063)
node src/rawCall.ts     # wywołanie bez biblioteki gRPC, przez node:http2
node src/wire.ts        # bajty komunikatu rozpisane na tagi i wartości
node src/jsonServer.ts  # serwer JSON na 4070; potem node src/compare.ts (wymaga też LockerService)
grpcurl -plaintext localhost:50061 list
grpcurl -plaintext -d '{"id":"WAW01"}' localhost:50061 lockers.v1.LockerService/GetLocker
```

## Pliki

| Plik | Zawartość |
|---|---|
| `proto/lockers/v1/lockers.proto` | kontrakt usługi skrytek: `LockerService` (`GetLocker`, `ReserveCompartment`), komunikaty, `enum CompartmentSize` |
| `proto/shipments/v1/shipments.proto` | kontrakt usługi przesyłek: `ShipmentService.CreateShipment`, import rozmiaru z pliku skrytek |
| `src/data.ts` | paczkomaty, skrytki i przesyłki w pamięci; funkcja `getLocker` |
| `src/local.ts` | wywołanie lokalne `getLocker` (punkt wyjścia segmentu 1) |
| `src/proto.ts` | ładowanie plików `.proto` (`loadSync`) i typy wygenerowane przez `proto-loader-gen-types` |
| `src/lockerServer.ts` | serwer `LockerService`: handlery, kody statusu, reflection |
| `src/errors.ts` | `INVALID_ARGUMENT` z `google.rpc.BadRequest` (serwer; `Status.serialize` z definicji ładowanej dynamicznie) oraz odczyt szczegółów (`Status.deserialize`) i wypisanie błędu (klient) |
| `src/reflection.ts` | `addImport`: dopisuje importy do opisów plików, których `proto-loader` nie zapisuje (bez tego `grpcurl` nie składa typów z `google.protobuf.Timestamp`) |
| `src/client.ts` | kanał i stub klienta `LockerService`; wywołania udane i odrzucone |
| `src/shipmentServer.ts` | serwer `ShipmentService`: woła `LockerService`, przekazuje jego błędy dalej |
| `src/shipmentClient.ts` | klient `ShipmentService` |
| `src/balance.ts` | klient z listą dwóch adresów i `round_robin` |
| `src/rawCall.ts` | wywołanie gRPC bez biblioteki gRPC: `node:http2`, prefiks ramki, nagłówki końcowe |
| `src/wire.ts` | `protobufjs` (obok `reflection.ts` jedyne miejsce, gdzie jest potrzebny) i czytnik tagów: format przewodowy w bajtach |
| `src/jsonServer.ts`, `src/compare.ts` | ta sama odpowiedź jako JSON przez HTTP/1.1 i pomiar rozmiaru oraz czasu (segment 9) |

`src/generated/` nie jest w repozytorium: powstaje z `npm run generate`.
