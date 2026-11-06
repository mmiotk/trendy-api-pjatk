import { promisify } from "node:util";
import * as grpc from "@grpc/grpc-js";
import { attempt } from "./errors.ts";
import { lockersPackage } from "./proto.ts";

// Kanał do serwera i stub: obiekt z metodami o nazwach z usługi.
const client = new lockersPackage.lockers.v1.LockerService("localhost:50061", grpc.credentials.createInsecure());

// Stub przyjmuje callback; promisify zamienia go na obietnicę, żeby wywołania szły jedno po drugim.
const getLocker = promisify(client.GetLocker).bind(client);
const reserveCompartment = promisify(client.ReserveCompartment).bind(client);

await attempt("get WAW01", getLocker({ id: "WAW01" }));
await attempt("get WAW99", getLocker({ id: "WAW99" }));
await attempt("reserve small", reserveCompartment({ lockerId: "WAW01", size: "COMPARTMENT_SIZE_SMALL", postalCode: "00-001" }));
await attempt("reserve large", reserveCompartment({ lockerId: "WAW01", size: "COMPARTMENT_SIZE_LARGE", postalCode: "00-001" }));
await attempt("reserve without size", reserveCompartment({ lockerId: "WAW01", postalCode: "0001" }));
client.close();
