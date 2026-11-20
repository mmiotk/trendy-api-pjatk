import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader"; // .proto bez protoc
// Tylko typy: `import type` znika po kompilacji.
import type { ProtoGrpcType as LockersGrpcType } from "./generated/lockers.ts";
import type { ProtoGrpcType as ShipmentsGrpcType } from "./generated/shipments.ts";

const options: protoLoader.Options = {
  includeDirs: ["proto"], // stąd liczą się ścieżki do plików .proto
  enums: String, // enum jako nazwa wartości, nie liczba
  defaults: true, // brakujące pola dostają wartość domyślną
};
const lockersDefinition = protoLoader.loadSync(
  "lockers/v1/lockers.proto", options);

// Ten sam pakiet, teraz z typami z generatora.
const loaded = grpc.loadPackageDefinition(lockersDefinition);
// tsc nie sprawdzi, czy typ pasuje do wczytanego pliku .proto.
export const lockersPackage = loaded as unknown as LockersGrpcType;

const shipmentsDefinition = protoLoader.loadSync(
  "shipments/v1/shipments.proto",
  options, // includeDirs: proto, tam leży importowany lockers.proto
);
const shipmentsGrpc = grpc.loadPackageDefinition(shipmentsDefinition);
export const shipmentsPackage = shipmentsGrpc as unknown as ShipmentsGrpcType;
