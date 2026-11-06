import * as grpc from "@grpc/grpc-js";
import { ReflectionService } from "@grpc/reflection";
import { getLocker } from "./data.ts";
import { invalidArgument, type Violation } from "./errors.ts";
import type { LockerServiceHandlers } from "./generated/lockers/v1/LockerService.ts";
import { lockersDefinition, lockersPackage } from "./proto.ts";
import { addImport } from "./reflection.ts";

const port = process.env.PORT ?? "50061";
let reservations = 0;

// Handlery mają typy wygenerowane z pliku .proto: literówka w nazwie pola zatrzyma `tsc`.
const handlers: LockerServiceHandlers = {
  GetLocker: (call, callback) => {
    console.log(`:${port} GetLocker ${call.request.id}`);
    // Nieznany paczkomat to NOT_FOUND: klient dostaje kod statusu i komunikat, a nie pustą odpowiedź.
    // Pole details w błędzie grpc-js to komunikat tekstowy; „szczegóły błędu” z BadRequest to co innego, o nich niżej.
    const locker = getLocker(call.request.id);
    if (!locker) return callback({ code: grpc.status.NOT_FOUND, details: `Locker ${call.request.id} does not exist` });
    callback(null, { locker });
  },
  ReserveCompartment: (call, callback) => {
    const { lockerId, size, postalCode } = call.request;
    // Najpierw sprawdza się argumenty; każde złamane pole trafia do jednej listy szczegółów.
    const violations: Violation[] = [];
    if (size === "COMPARTMENT_SIZE_UNSPECIFIED") {
      violations.push({ field: "size", description: "size must be SMALL, MEDIUM or LARGE" });
    }
    if (!/^\d{2}-\d{3}$/.test(postalCode)) {
      violations.push({ field: "postal_code", description: "postal code must look like 00-001" });
    }
    if (violations.length > 0) return callback(invalidArgument("Invalid reservation request", violations));
    const locker = getLocker(lockerId);
    if (!locker) return callback({ code: grpc.status.NOT_FOUND, details: `Locker ${lockerId} does not exist` });
    // Brak wolnej skrytki to nie błąd wywołania, tylko stan, w którym operacja jest niemożliwa: FAILED_PRECONDITION.
    const compartment = locker.compartments.find((c) => c.free && c.size === size);
    if (!compartment) {
      return callback({ code: grpc.status.FAILED_PRECONDITION, details: `Locker ${lockerId} has no free ${size} compartment` });
    }
    compartment.free = false;
    reservations += 1;
    callback(null, {
      compartmentId: compartment.id,
      pickupCode: String(480000 + reservations),
      expiresAt: { seconds: Math.floor(Date.now() / 1000) + 24 * 60 * 60 },
    });
  },
};

const server = new grpc.Server();
server.addService(lockersPackage.lockers.v1.LockerService.service, handlers);
// Reflection serwera: serwer opisuje własne API, więc grpcurl nie potrzebuje pliku .proto.
addImport(lockersDefinition, "lockers_v1.proto", "google_protobuf.proto");
new ReflectionService(lockersDefinition).addToServer(server);

server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (error) => {
  if (error) throw error;
  console.log(`LockerService on port ${port}`);
});
