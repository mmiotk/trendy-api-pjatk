import * as grpc from "@grpc/grpc-js";
import { getLocker } from "./data.ts";
import { invalidArgument, type Violation } from "./errors.ts";
import type { LockerServiceHandlers } from "./generated/lockers/v1/LockerService.ts";
import { lockersPackage } from "./proto.ts";

let reservations = 0;

// Handlery mają typy wygenerowane z pliku .proto: literówka w nazwie pola zatrzyma `tsc`.
const handlers: LockerServiceHandlers = {
  GetLocker: (call, callback) => {
    // Nieznany paczkomat to NOT_FOUND: klient dostaje kod statusu i komunikat zamiast pustej odpowiedzi.
    const locker = getLocker(call.request.id);
    if (!locker) return callback({ code: grpc.status.NOT_FOUND, details: `Locker ${call.request.id} does not exist` });
    callback(null, { locker });
  },
  ReserveCompartment: (call, callback) => {
    const { lockerId, size, postalCode } = call.request;
    // Najpierw argumenty: każde złamane pole trafia do jednej listy naruszeń.
    const violations: Violation[] = [];
    if (size === "COMPARTMENT_SIZE_UNSPECIFIED") violations.push({ field: "size", description: "size must be SMALL, MEDIUM or LARGE" });
    if (!/^\d{2}-\d{3}$/.test(postalCode)) violations.push({ field: "postal_code", description: "postal code must look like 00-001" });
    if (violations.length > 0) return callback(invalidArgument(violations));
    const locker = getLocker(lockerId);
    if (!locker) return callback({ code: grpc.status.NOT_FOUND, details: `Locker ${lockerId} does not exist` });
    // Brak wolnej skrytki to stan, w którym operacja jest niemożliwa: FAILED_PRECONDITION.
    const compartment = locker.compartments.find((c) => c.free && c.size === size);
    if (!compartment) return callback({ code: grpc.status.FAILED_PRECONDITION, details: `No free ${size} compartment in ${lockerId}` });
    compartment.free = false;
    reservations += 1;
    callback(null, { compartmentId: compartment.id, pickupCode: String(480000 + reservations) });
  },
};

const server = new grpc.Server();
server.addService(lockersPackage.lockers.v1.LockerService.service, handlers);

server.bindAsync("0.0.0.0:50061", grpc.ServerCredentials.createInsecure(), (error) => {
  if (error) throw error;
  console.log("LockerService on port 50061");
});
