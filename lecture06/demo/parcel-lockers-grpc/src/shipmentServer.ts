import * as grpc from "@grpc/grpc-js";
import type { ShipmentServiceHandlers } from "./generated/shipments/v1/ShipmentService.ts";
import { lockersPackage, shipmentsPackage } from "./proto.ts";

// Ten sam rodzaj stubu co w client.ts: dla skrytek to zwykły klient.
// Kanał powstaje raz, przy starcie procesu, nie przy każdym żądaniu.
const { LockerService } = lockersPackage.lockers.v1;
const lockerClient = new LockerService(
  "localhost:50061",
  grpc.credentials.createInsecure(), // bez TLS, jak serwer skrytek
);

// Licznik przesyłek, osobny od licznika rezerwacji w usłudze skrytek.
let shipments = 0; // w pamięci procesu: restart liczy od 1

// Błąd skrytek idzie do klienta bez zmian. Babal (Order → Payment) składa
// zamiast tego własny błąd i ukrywa podział na usługi. Na granicy z REST
// błąd gRPC i tak trzeba zamienić na błąd tamtego API.
const handlers: ShipmentServiceHandlers = {
  CreateShipment: (call, callback) => {
    const { lockerId, size, recipientPostalCode } = call.request;
    // Kontrakt skrytek nazywa to pole postalCode.
    const request = { lockerId, size, postalCode: recipientPostalCode };
    lockerClient.ReserveCompartment(request, (error, reservation) => {
      // Błąd skrytek w całości: kod, komunikat i BadRequest z metadanych.
      if (error) return callback(error);
      shipments += 1; // tylko po udanej rezerwacji
      // ! mówi TypeScriptowi: bez błędu odpowiedź jest.
      const pickupCode = reservation!.pickupCode; // kod nadają skrytki
      callback(null, { shipmentId: `SH-${shipments}`, pickupCode });
    });
  },
};

// Składanie serwera jak w lockerServer.ts: addService, potem bindAsync.
const server = new grpc.Server();
const { ShipmentService } = shipmentsPackage.shipments.v1;
server.addService(ShipmentService.service, handlers);

// Osobny proces i port: przesyłki 50062, skrytki 50061.
const credentials = grpc.ServerCredentials.createInsecure();
server.bindAsync("0.0.0.0:50062", credentials, (error) => {
  if (error) throw error;
  console.log("ShipmentService on port 50062");
});
