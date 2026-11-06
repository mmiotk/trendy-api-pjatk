# Parcel Lockers gRPC: usługi skrytek i przesyłek

Projekt referencyjny wykładu 06 (RPC i podstawy gRPC): dwie usługi gRPC o paczkomatach, zbudowane krok po kroku w
`../PROWADZACY.md`. `LockerService` (port 50061) zwraca paczkomat i rezerwuje skrytkę, `ShipmentService` (port 50062)
tworzy przesyłkę i woła `LockerService` przez stub klienta. Dane leżą w pamięci procesu (`src/data.ts`), więc każdy restart
serwera przywraca stan początkowy.

Wymagania: Node.js 24 (uruchamia pliki `.ts` bez kompilacji), npm 11, opcjonalnie `grpcurl` 1.9.4 (`~/.local/bin/grpcurl`).
Wersje bibliotek są przypięte: `@grpc/grpc-js` 1.14.6, `@grpc/proto-loader` 0.8.1, `google-proto-files` 6.1.0 (pliki
`google/rpc/*.proto` dla `BadRequest`; ładuje je `errors.ts` przez `proto-loader`), TypeScript 7.0.2 (tylko `tsc --noEmit`).
Serwery nie wystawiają reflection, więc `grpcurl` dostaje plik kontraktu przez `-import-path` i `-proto`.

## Uruchomienie

```bash
npm ci
npm run generate        # typy z plików .proto do src/generated/ (katalog w .gitignore)
npm run typecheck       # tsc --noEmit
npm run locker          # LockerService na 50061 (restart po zmianie src/ i proto/)
npm run shipment        # ShipmentService na 50062 (wymaga działającego LockerService na 50061)
node src/rawCall.ts     # wywołanie bez biblioteki gRPC, przez node:http2
node src/wire.ts        # bajty jednej skrytki rozpisane na tagi i wartości
node src/client.ts      # klient usługi skrytek, błędy z kodami statusu
node src/shipmentClient.ts
grpcurl -plaintext -import-path proto -proto lockers/v1/lockers.proto \
  -d '{"id":"WAW01"}' localhost:50061 lockers.v1.LockerService/GetLocker
```

## Pliki

| Plik | Zawartość |
|---|---|
| `proto/lockers/v1/lockers.proto` | kontrakt usługi skrytek: `LockerService` (`GetLocker`, `ReserveCompartment`), `Locker`, `Compartment`, `enum CompartmentSize` |
| `proto/shipments/v1/shipments.proto` | kontrakt usługi przesyłek: `ShipmentService.CreateShipment`, import rozmiaru z pliku skrytek |
| `src/data.ts` | paczkomat i skrytki w pamięci; funkcja `getLocker` |
| `src/proto.ts` | ładowanie plików `.proto` (`loadSync`) i typy wygenerowane przez `proto-loader-gen-types` |
| `src/rawCall.ts` | jedno wywołanie gRPC bez biblioteki gRPC: `node:http2`, prefiks ramki, nagłówki końcowe |
| `src/wire.ts` | skrytka zakodowana `serialize` i czytnik rekordów: tag, typ przewodowy, długość, wartość |
| `src/lockerServer.ts` | serwer `LockerService`: handlery i kody statusu |
| `src/errors.ts` | `INVALID_ARGUMENT` z `google.rpc.BadRequest` (serwer) i `attempt`, które wypisuje wynik albo kod, komunikat i naruszenia (klient) |
| `src/client.ts` | kanał i stub klienta `LockerService`; wywołania udane i odrzucone |
| `src/shipmentServer.ts` | serwer `ShipmentService`: woła `LockerService`, przekazuje jego błędy dalej |
| `src/shipmentClient.ts` | klient `ShipmentService` |

`src/generated/` nie jest w repozytorium: powstaje z `npm run generate`. Pomiar JSON kontra gRPC ze slajdu 09 nie należy do
projektu; skrypt i wyniki są w `../POMIARY.md`.
