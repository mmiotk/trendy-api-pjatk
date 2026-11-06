import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import type { ProtoGrpcType as LockersGrpcType } from "./generated/lockers.ts";
import type { ProtoGrpcType as ShipmentsGrpcType } from "./generated/shipments.ts";

// Opcje ładowania: `includeDirs` to katalog, od którego liczą się ścieżki importów w plikach .proto.
const options: protoLoader.Options = {
  includeDirs: ["proto"],
  enums: String, // enumy jako nazwy wartości, nie liczby
  defaults: true, // brakujące pola dostają wartość domyślną
};

// Plik .proto jest czytany przy starcie procesu, więc serwer i klient widzą ten sam opis usługi.
const lockersDefinition = protoLoader.loadSync("lockers/v1/lockers.proto", options);

// Ten sam pakiet, ale z typami wygenerowanymi z pliku .proto.
export const lockersPackage = grpc.loadPackageDefinition(lockersDefinition) as unknown as LockersGrpcType;

const shipmentsDefinition = protoLoader.loadSync("shipments/v1/shipments.proto", options);
export const shipmentsPackage = grpc.loadPackageDefinition(shipmentsDefinition) as unknown as ShipmentsGrpcType;
