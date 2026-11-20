import { promisify } from "node:util";
import * as grpc from "@grpc/grpc-js";
import { attempt } from "./errors.ts";
import { lockersPackage } from "./proto.ts";

// Kanał i stub w jednym; adres i brak TLS muszą pasować do serwera.
const { LockerService } = lockersPackage.lockers.v1;
const credentials = grpc.credentials.createInsecure();
const client = new LockerService("localhost:50061", credentials);

// promisify zamienia callback na obietnicę; bind zachowuje stub jako this.
const getLocker = promisify(client.GetLocker).bind(client);
const reserveCompartment = promisify(client.ReserveCompartment).bind(client);

// Pięć wywołań jednym kanałem; błąd nie przerywa programu.
await attempt("get WAW01", getLocker({ id: "WAW01" }));
await attempt("get WAW99", getLocker({ id: "WAW99" })); // nie ma w danych
await attempt("reserve small", reserveCompartment({
  lockerId: "WAW01", size: "COMPARTMENT_SIZE_SMALL", postalCode: "00-001",
}));
await attempt("reserve large", reserveCompartment({ // duża jest zajęta
  lockerId: "WAW01", size: "COMPARTMENT_SIZE_LARGE", postalCode: "00-001",
}));
// Bez size (wartość zero enuma) i zły kod pocztowy: dwa naruszenia.
await attempt("reserve without size", reserveCompartment({
  lockerId: "WAW01", postalCode: "0001",
}));
client.close();
