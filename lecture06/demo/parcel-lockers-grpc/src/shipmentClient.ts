import { promisify } from "node:util";
import * as grpc from "@grpc/grpc-js";
import { attempt } from "./errors.ts"; // ta sama funkcja co w client.ts
import { shipmentsPackage } from "./proto.ts";

// Kształt jak w client.ts: kanał i stub, potem promisify.
const { ShipmentService } = shipmentsPackage.shipments.v1;
const credentials = grpc.credentials.createInsecure();
const client = new ShipmentService("localhost:50062", credentials);
const createShipment = promisify(client.CreateShipment).bind(client);

await attempt("shipment small", createShipment({
  lockerId: "WAW01", size: "COMPARTMENT_SIZE_SMALL",
  recipientPostalCode: "00-001",
}));
await attempt("shipment to WAW99", createShipment({
  lockerId: "WAW99", size: "COMPARTMENT_SIZE_SMALL", // brak paczkomatu
  recipientPostalCode: "00-001",
}));
await attempt("shipment with bad code", createShipment({
  lockerId: "WAW01", size: "COMPARTMENT_SIZE_SMALL",
  recipientPostalCode: "0001", // sprawdza dopiero usługa skrytek
}));
client.close();
