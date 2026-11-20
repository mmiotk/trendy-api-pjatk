import * as grpc from "@grpc/grpc-js";
import { getLocker } from "./data.ts";
import { invalidArgument, type Violation } from "./errors.ts";
import type { LockerServiceHandlers } from "./generated/lockers/v1/LockerService.ts";
import { lockersPackage } from "./proto.ts";

let reservations = 0; // w pamięci procesu: restart zeruje licznik

// Typy z generatora: zła nazwa metody albo pola zatrzymuje tsc.
const handlers: LockerServiceHandlers = {
  GetLocker: (call, callback) => {
    const { id } = call.request;
    const locker = getLocker(id); // undefined: nie ma paczkomatu
    if (!locker) return callback({
      code: grpc.status.NOT_FOUND, // liczba 5
      details: `Locker ${id} does not exist`, // komunikat
    });
    callback(null, { locker }); // null = sukces
  },
  ReserveCompartment: (call, callback) => {
    const { lockerId, size, postalCode } = call.request;
    const violations: Violation[] = []; // wszystkie złe pola naraz
    if (size === "COMPARTMENT_SIZE_UNSPECIFIED") { // wartość zero
      violations.push({
        field: "size",
        description: "size must be SMALL, MEDIUM or LARGE",
      });
    }
    if (!/^\d{2}-\d{3}$/.test(postalCode)) { // format 00-000
      violations.push({
        field: "postal_code", // nazwa pola z pliku .proto
        description: "postal code must look like 00-001",
      });
    }
    if (violations.length > 0) return callback(invalidArgument(violations));
    const locker = getLocker(lockerId); // najpierw paczkomat
    if (!locker) return callback({
      code: grpc.status.NOT_FOUND,
      details: `Locker ${lockerId} does not exist`,
    });
    const compartment = locker.compartments
      .find((c) => c.free && c.size === size); // pierwsza wolna skrytka
    if (!compartment) return callback({
      code: grpc.status.FAILED_PRECONDITION, // stan nie pozwala
      details: `No free ${size} compartment in ${lockerId}`,
    });
    compartment.free = false; // zmiana stanu: skrytka zajęta
    reservations += 1;
    const pickupCode = String(480000 + reservations); // pierwszy kod: 480001
    callback(null, { compartmentId: compartment.id, pickupCode });
  },
};

const server = new grpc.Server();
// Opis usługi z .proto + handlery, metoda po metodzie.
server.addService(lockersPackage.lockers.v1.LockerService.service, handlers);

const credentials = grpc.ServerCredentials.createInsecure(); // bez TLS
server.bindAsync("0.0.0.0:50061", credentials, (error) => {
  if (error) throw error; // np. port zajęty: proces się kończy
  console.log("LockerService on port 50061");
});
