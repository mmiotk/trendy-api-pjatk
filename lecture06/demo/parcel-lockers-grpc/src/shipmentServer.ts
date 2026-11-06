import * as grpc from "@grpc/grpc-js";
import { ReflectionService } from "@grpc/reflection";
import { shipments } from "./data.ts";
import type { ShipmentServiceHandlers } from "./generated/shipments/v1/ShipmentService.ts";
import { lockersPackage, shipmentsDefinition, shipmentsPackage } from "./proto.ts";
import { addImport } from "./reflection.ts";

// ShipmentService jest klientem LockerService: ma stub, który woła usługę skrytek przez sieć.
const lockerClient = new lockersPackage.lockers.v1.LockerService("localhost:50061", grpc.credentials.createInsecure());

const handlers: ShipmentServiceHandlers = {
  CreateShipment: (call, callback) => {
    const { lockerId, size, recipientPostalCode } = call.request;
    lockerClient.ReserveCompartment({ lockerId, size, postalCode: recipientPostalCode }, (error, reservation) => {
      // Błąd z usługi skrytek idzie dalej bez zmian: ten sam kod, komunikat i szczegóły.
      if (error) return callback(error);
      const shipment = { id: `SH-${shipments.length + 1}`, compartmentId: reservation!.compartmentId };
      shipments.push(shipment);
      callback(null, { shipmentId: shipment.id, compartmentId: shipment.compartmentId, pickupCode: reservation!.pickupCode });
    });
  },
};

const server = new grpc.Server();
server.addService(shipmentsPackage.shipments.v1.ShipmentService.service, handlers);
// Reflection tylko dla własnej usługi; importy między pakietami trzeba dopisać tak samo jak w usłudze skrytek.
addImport(shipmentsDefinition, "lockers_v1.proto", "google_protobuf.proto");
addImport(shipmentsDefinition, "shipments_v1.proto", "lockers_v1.proto");
new ReflectionService(shipmentsDefinition, { services: ["shipments.v1.ShipmentService"] }).addToServer(server);

server.bindAsync("0.0.0.0:50062", grpc.ServerCredentials.createInsecure(), (error) => {
  if (error) throw error;
  console.log("ShipmentService on port 50062");
});
