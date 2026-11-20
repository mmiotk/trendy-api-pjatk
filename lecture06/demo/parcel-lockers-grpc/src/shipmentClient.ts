import { promisify } from "node:util";
import * as grpc from "@grpc/grpc-js";
import { attempt } from "./errors.ts"; // ta sama funkcja co w client.ts: wypisuje odpowiedź albo kod, komunikat i naruszenia
import { shipmentsPackage } from "./proto.ts";

const client = new shipmentsPackage.shipments.v1.ShipmentService("localhost:50062", grpc.credentials.createInsecure());
// promisify zamienia metodę z callbackiem w funkcję zwracającą Promise; bind zachowuje stub jako this.
const createShipment = promisify(client.CreateShipment).bind(client);

await attempt("shipment small", createShipment({ lockerId: "WAW01", size: "COMPARTMENT_SIZE_SMALL", recipientPostalCode: "00-001" }));
await attempt("shipment to WAW99", createShipment({ lockerId: "WAW99", size: "COMPARTMENT_SIZE_SMALL", recipientPostalCode: "00-001" })); // NOT_FOUND z usługi skrytek
// Zły kod pocztowy sprawdza dopiero usługa skrytek; usługa przesyłek go nie waliduje.
await attempt("shipment with bad code", createShipment({ lockerId: "WAW01", size: "COMPARTMENT_SIZE_SMALL", recipientPostalCode: "0001" }));
client.close();
