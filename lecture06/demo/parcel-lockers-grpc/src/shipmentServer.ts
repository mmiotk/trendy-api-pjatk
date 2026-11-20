import * as grpc from "@grpc/grpc-js";
import type { ShipmentServiceHandlers } from "./generated/shipments/v1/ShipmentService.ts";
import { lockersPackage, shipmentsPackage } from "./proto.ts";

// ShipmentService jest klientem LockerService: ma stub, który woła usługę skrytek przez sieć.
// Jedna linia tworzy kanał z adresem usługi skrytek i klienta; powstaje raz, przy starcie procesu.
const lockerClient = new lockersPackage.lockers.v1.LockerService("localhost:50061", grpc.credentials.createInsecure());
let shipments = 0; // licznik w pamięci procesu przesyłek: po restarcie liczy znów od 1

const handlers: ShipmentServiceHandlers = {
  CreateShipment: (call, callback) => {
    const { lockerId, size, recipientPostalCode } = call.request;
    // Pole recipientPostalCode trafia do postalCode, bo tak nazywa się pole w kontrakcie skrytek.
    lockerClient.ReserveCompartment({ lockerId, size, postalCode: recipientPostalCode }, (error, reservation) => {
      // Błąd z usługi skrytek idzie dalej bez zmian: ten sam kod, komunikat i szczegóły.
      if (error) return callback(error);
      shipments += 1; // licznik rośnie tylko po udanej rezerwacji
      // Wykrzyknik mówi TypeScriptowi, że bez błędu odpowiedź jest; kod odbioru nadała usługa skrytek.
      callback(null, { shipmentId: `SH-${shipments}`, pickupCode: reservation!.pickupCode });
    });
  },
};

const server = new grpc.Server();
server.addService(shipmentsPackage.shipments.v1.ShipmentService.service, handlers);

// Osobny proces na osobnym porcie: przesyłki na 50062, skrytki na 50061.
server.bindAsync("0.0.0.0:50062", grpc.ServerCredentials.createInsecure(), (error) => {
  if (error) throw error;
  console.log("ShipmentService on port 50062");
});
