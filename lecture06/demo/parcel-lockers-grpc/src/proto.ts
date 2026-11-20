import * as grpc from "@grpc/grpc-js"; // gRPC napisane w samym JavaScripcie, bez kodu natywnego
import * as protoLoader from "@grpc/proto-loader"; // czyta pliki .proto w czasie działania, bez protoc
// ProtoGrpcType opisuje drzewo lockers.v1.*: typy każdego komunikatu i konstruktor klienta usługi z polem `service`.
import type { ProtoGrpcType as LockersGrpcType } from "./generated/lockers.ts"; // `import type` znika po kompilacji, w czasie działania nic nie wczytuje
import type { ProtoGrpcType as ShipmentsGrpcType } from "./generated/shipments.ts"; // typy wygenerowane dla drugiego pliku

// Opcje ładowania: `includeDirs` to katalog, od którego liczą się ścieżki importów w plikach .proto.
const options: protoLoader.Options = {
  includeDirs: ["proto"],
  enums: String, // enumy jako nazwy wartości, nie liczby
  defaults: true, // brakujące pola dostają wartość domyślną
};

// Plik .proto jest czytany przy starcie procesu, więc serwer i klient widzą ten sam opis usługi.
const lockersDefinition = protoLoader.loadSync("lockers/v1/lockers.proto", options);

// Ten sam pakiet, ale z typami wygenerowanymi z pliku .proto.
// `as unknown as` zamienia ogólny typ GrpcObject na typ z generatora. To jedyne miejsce, w którym kod ufa generatorowi:
// tsc nie sprawdza, czy typ i wczytany plik .proto opisują to samo.
// Od tej linii LockerService ma typ konstruktora klienta, a jego pole `.service` to definicja, którą przyjmuje addService.
export const lockersPackage = grpc.loadPackageDefinition(lockersDefinition) as unknown as LockersGrpcType;

// Te same opcje co dla skrytek; import lockers/v1/lockers.proto proto-loader znajduje w katalogu proto.
const shipmentsDefinition = protoLoader.loadSync("shipments/v1/shipments.proto", options);
export const shipmentsPackage = grpc.loadPackageDefinition(shipmentsDefinition) as unknown as ShipmentsGrpcType;
