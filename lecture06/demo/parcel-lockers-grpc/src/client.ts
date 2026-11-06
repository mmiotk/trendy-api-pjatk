import { promisify } from "node:util";
import * as grpc from "@grpc/grpc-js";
import { lockersPackage } from "./proto.ts";
import { attempt } from "./errors.ts";

// Kanał do serwera i stub: obiekt z metodami o nazwach z usługi.
const client = new lockersPackage.lockers.v1.LockerService("localhost:50061", grpc.credentials.createInsecure());

// Stub przyjmuje callback; promisify zamienia go na obietnicę, żeby wywołania szły jedno po drugim.
const getLocker = promisify(client.GetLocker).bind(client);
const reserveCompartment = promisify(client.ReserveCompartment).bind(client);

await attempt("get WAW01", getLocker({ id: "WAW01" }));
await attempt("get WAW99", getLocker({ id: "WAW99" }));
await attempt("reserve small in WAW01", reserveCompartment({ lockerId: "WAW01", size: "COMPARTMENT_SIZE_SMALL", postalCode: "00-001" }));
await attempt("reserve medium in KRK01", reserveCompartment({ lockerId: "KRK01", size: "COMPARTMENT_SIZE_MEDIUM", postalCode: "30-001" }));
await attempt("reserve without size", reserveCompartment({ lockerId: "WAW01", postalCode: "0001" }));
client.close();
