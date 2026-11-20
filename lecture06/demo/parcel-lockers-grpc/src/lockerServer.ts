import * as grpc from "@grpc/grpc-js";
import { getLocker } from "./data.ts";
// Violation istnieje tylko w czasie kompilacji; Node usuwa typy przy uruchamianiu, więc import typu ma słowo type.
import { invalidArgument, type Violation } from "./errors.ts";
import type { LockerServiceHandlers } from "./generated/lockers/v1/LockerService.ts"; // interfejs z generatora: każda metoda ma typ grpc.handleUnaryCall
import { lockersPackage } from "./proto.ts";

// Licznik rezerwacji żyje w pamięci procesu: po restarcie serwera liczy od zera.
let reservations = 0;

// Handlery mają typy wygenerowane z pliku .proto: literówka w nazwie pola zatrzyma `tsc`.
const handlers: LockerServiceHandlers = {
  // call.request to żądanie zdeserializowane do obiektu; callback(błąd, odpowiedź) odsyła wynik, a null oznacza powodzenie.
  GetLocker: (call, callback) => {
    // Nieznany paczkomat to NOT_FOUND: klient dostaje kod statusu i komunikat zamiast pustej odpowiedzi.
    const locker = getLocker(call.request.id); // undefined, gdy paczkomatu o tym identyfikatorze nie ma
    // Błąd idzie jako pierwszy argument callbacku: code to liczba kodu, details to komunikat tekstowy.
    // Mimo nazwy pole details nie zawiera szczegółów błędu w rozumieniu gRPC; te jadą osobno, w metadanych.
    if (!locker) return callback({ code: grpc.status.NOT_FOUND, details: `Locker ${call.request.id} does not exist` });
    callback(null, { locker }); // sukces: null w miejscu błędu, potem odpowiedź
  },
  ReserveCompartment: (call, callback) => {
    const { lockerId, size, postalCode } = call.request;
    // Najpierw argumenty: każde złamane pole trafia do jednej listy naruszeń.
    const violations: Violation[] = [];
    // Wartość zero enuma oznacza, że klient rozmiaru nie ustawił.
    if (size === "COMPARTMENT_SIZE_UNSPECIFIED") violations.push({ field: "size", description: "size must be SMALL, MEDIUM or LARGE" });
    // Kod pocztowy ma postać 00-000; zły format jest zły niezależnie od stanu paczkomatu.
    if (!/^\d{2}-\d{3}$/.test(postalCode)) violations.push({ field: "postal_code", description: "postal code must look like 00-001" });
    // Odpowiedź dopiero po obu sprawdzeniach, więc klient dostaje pełną listę naraz.
    if (violations.length > 0) return callback(invalidArgument(violations));
    // Najpierw paczkomat, potem skrytka: wolnej skrytki szuka się tylko w paczkomacie, który istnieje.
    const locker = getLocker(lockerId);
    if (!locker) return callback({ code: grpc.status.NOT_FOUND, details: `Locker ${lockerId} does not exist` });
    // Brak wolnej skrytki to stan, w którym operacja jest niemożliwa: FAILED_PRECONDITION.
    const compartment = locker.compartments.find((c) => c.free && c.size === size);
    // W komunikacie stoi nazwa wartości enuma, np. COMPARTMENT_SIZE_LARGE, bo generator działa z --enums=String.
    if (!compartment) return callback({ code: grpc.status.FAILED_PRECONDITION, details: `No free ${size} compartment in ${lockerId}` });
    compartment.free = false; // zmiana stanu: skrytka zostaje zajęta w pamięci procesu
    reservations += 1;
    callback(null, { compartmentId: compartment.id, pickupCode: String(480000 + reservations) }); // pierwsza rezerwacja po starcie dostaje 480001
  },
};

const server = new grpc.Server();
// addService wiąże definicję usługi z pliku .proto z obiektem handlerów, metoda po metodzie.
server.addService(lockersPackage.lockers.v1.LockerService.service, handlers);

// 0.0.0.0: wszystkie interfejsy sieciowe; createInsecure(): połączenie bez TLS. Wynik wiązania portu trafia do funkcji zwrotnej.
server.bindAsync("0.0.0.0:50061", grpc.ServerCredentials.createInsecure(), (error) => {
  if (error) throw error; // port zajęty albo niedostępny: proces kończy się błędem
  console.log("LockerService on port 50061");
});
