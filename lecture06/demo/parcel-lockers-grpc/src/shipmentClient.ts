import { promisify } from "node:util";
import * as grpc from "@grpc/grpc-js";
import { attempt } from "./errors.ts";
import { shipmentsPackage } from "./proto.ts";

const client = new shipmentsPackage.shipments.v1.ShipmentService("localhost:50062", grpc.credentials.createInsecure());
const createShipment = promisify(client.CreateShipment).bind(client);

await attempt("shipment to WAW01", createShipment({ lockerId: "WAW01", size: "COMPARTMENT_SIZE_MEDIUM", recipientPostalCode: "00-001" }));
await attempt("shipment to WAW99", createShipment({ lockerId: "WAW99", size: "COMPARTMENT_SIZE_SMALL", recipientPostalCode: "00-001" }));
await attempt("shipment to KRK01", createShipment({ lockerId: "KRK01", size: "COMPARTMENT_SIZE_MEDIUM", recipientPostalCode: "30-001" }));
await attempt("shipment with bad code", createShipment({ lockerId: "WAW01", size: "COMPARTMENT_SIZE_SMALL", recipientPostalCode: "0001" }));
client.close();
