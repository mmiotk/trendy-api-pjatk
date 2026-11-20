import * as grpc from "@grpc/grpc-js"; // gRPC w samym JavaScripcie
import * as protoLoader from "@grpc/proto-loader"; // .proto bez protoc
// Tylko typy: `import type` znika po kompilacji.
import type { ProtoGrpcType as LockersGrpcType } from "./generated/lockers.ts";
import type { ProtoGrpcType as ShipmentsGrpcType } from "./generated/shipments.ts";

const options: protoLoader.Options = {
  includeDirs: ["proto"], // stąd liczą się ścieżki do plików .proto
  enums: String, // enum jako nazwa wartości, jak w data.ts
  defaults: true, // brakujące pola dostają wartość domyślną
};
// Plik .proto czytany przy starcie procesu; serwer i klient,
// które importują proto.ts, widzą ten sam opis usługi.
const lockersDefinition = protoLoader.loadSync(
  "lockers/v1/lockers.proto", options);

// Typy z src/generated sprawdza tylko tsc; bajty w czasie działania
// koduje proto-loader. Po zmianie .proto bez npm run generate tsc
// sprawdza kod względem starego kontraktu.
const loaded = grpc.loadPackageDefinition(lockersDefinition);
// as unknown as: ogólny GrpcObject dostaje typ drzewa lockers.v1.*;
// tsc nie sprawdzi, czy typ pasuje do wczytanego pliku .proto.
export const lockersPackage = loaded as unknown as LockersGrpcType;

// Druga definicja z tymi samymi opcjami co kontrakt skrytek.
const shipmentsDefinition = protoLoader.loadSync(
  "shipments/v1/shipments.proto",
  options, // includeDirs: proto, tam leży importowany lockers.proto
);
const shipmentsGrpc = grpc.loadPackageDefinition(shipmentsDefinition);
// Jak przy skrytkach: tsc ufa, że typy z generatora opisują ten plik.
export const shipmentsPackage = shipmentsGrpc as unknown as ShipmentsGrpcType;
