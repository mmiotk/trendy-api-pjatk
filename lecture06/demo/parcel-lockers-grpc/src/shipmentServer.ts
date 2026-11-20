import * as grpc from "@grpc/grpc-js";
import type { ShipmentServiceHandlers } from "./generated/shipments/v1/ShipmentService.ts";
import { lockersPackage, shipmentsPackage } from "./proto.ts";

// Stub usługi skrytek: kanał powstaje raz, przy starcie procesu.
const { LockerService } = lockersPackage.lockers.v1;
const lockerClient = new LockerService(
  "localhost:50061",
  grpc.credentials.createInsecure(), // bez TLS, jak serwer skrytek
);

let shipments = 0; // w pamięci procesu: restart liczy od 1

const handlers: ShipmentServiceHandlers = {
  CreateShipment: (call, callback) => {
    const { lockerId, size, recipientPostalCode } = call.request;
    const request = { lockerId, size, postalCode: recipientPostalCode };
    lockerClient.ReserveCompartment(request, (error, reservation) => {
      if (error) return callback(error); // błąd skrytek bez zmian
      shipments += 1; // tylko po udanej rezerwacji
      const pickupCode = reservation!.pickupCode; // bez błędu odpowiedź jest
      callback(null, { shipmentId: `SH-${shipments}`, pickupCode });
    });
  },
};

const server = new grpc.Server();
const { ShipmentService } = shipmentsPackage.shipments.v1;
server.addService(ShipmentService.service, handlers);

// Osobny proces i port: przesyłki 50062, skrytki 50061.
const credentials = grpc.ServerCredentials.createInsecure();
server.bindAsync("0.0.0.0:50062", credentials, (error) => {
  if (error) throw error;
  console.log("ShipmentService on port 50062");
});
