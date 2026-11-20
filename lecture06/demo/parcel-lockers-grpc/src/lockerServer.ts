// Serwer usługi skrytek. Typ handlerów wymaga funkcji dla każdej metody
// z kontraktu: node uruchomi plik i bez niej (typy usuwa bez sprawdzania),
// ale tsc zgłosi brak.
import * as grpc from "@grpc/grpc-js";
import { getLocker } from "./data.ts";
// type: Node usuwa typy przy uruchamianiu, więc import typu je oznacza.
import { invalidArgument, type Violation } from "./errors.ts";
// Typ z generatora: po jednej funkcji na każdą metodę z LockerService.
import type { LockerServiceHandlers } from "./generated/lockers/v1/LockerService.ts";
import { lockersPackage } from "./proto.ts";

// Licznik rezerwacji żyje w pamięci procesu: restart serwera go zeruje.
let reservations = 0;

// Handler dostaje call.request, czyli żądanie zdekodowane z bajtów,
// i odsyła wynik przez callback(błąd, odpowiedź); null = sukces.
const handlers: LockerServiceHandlers = {
  GetLocker: (call, callback) => {
    const { id } = call.request;
    const locker = getLocker(id); // undefined: nie ma paczkomatu
    // Błąd idzie pierwszym argumentem, tam gdzie przy sukcesie stoi null.
    // return kończy handler: drugi callback się już nie wykona.
    if (!locker) return callback({
      code: grpc.status.NOT_FOUND, // liczba 5 z listy grpc.status
      // details w grpc-js to komunikat tekstowy, nie szczegóły błędu
      details: `Locker ${id} does not exist`,
    });
    callback(null, { locker }); // null = sukces
  },
  // Jedyna metoda, która zmienia stan serwera: zajmuje skrytkę
  // i wydaje kod odbioru. GetLocker tylko czyta.
  ReserveCompartment: (call, callback) => {
    // Pola żądania z ReserveCompartmentRequest, już jako obiekt.
    const { lockerId, size, postalCode } = call.request;
    const violations: Violation[] = []; // wszystkie złe pola naraz
    // Wartość zero enuma: klient nie ustawił rozmiaru.
    if (size === "COMPARTMENT_SIZE_UNSPECIFIED") {
      violations.push({
        field: "size",
        description: "size must be SMALL, MEDIUM or LARGE",
      });
    }
    // Zły format jest zły niezależnie od stanu paczkomatu.
    if (!/^\d{2}-\d{3}$/.test(postalCode)) { // format 00-000
      violations.push({
        field: "postal_code", // nazwa pola z pliku .proto
        description: "postal code must look like 00-001",
      });
    }
    // Walidacja stoi przed szukaniem paczkomatu: zły argument wygrywa
    // z NOT_FOUND, a klient dostaje pełną listę naraz.
    if (violations.length > 0) return callback(invalidArgument(violations));
    // Zajęta skrytka to FAILED_PRECONDITION: dokumentacja gRPC każe nie
    // ponawiać wywołania, dopóki stan systemu się nie zmieni.
    // Najpierw paczkomat: wolnej skrytki szuka się tylko w istniejącym.
    const locker = getLocker(lockerId);
    if (!locker) return callback({
      code: grpc.status.NOT_FOUND,
      details: `Locker ${lockerId} does not exist`,
    });
    const compartment = locker.compartments
      .find((c) => c.free && c.size === size); // pierwsza wolna skrytka
    // Żądanie jest poprawne, ale zajęta skrytka nie pozwala go wykonać.
    if (!compartment) return callback({
      code: grpc.status.FAILED_PRECONDITION, // liczba 9
      // size to nazwa wartości enuma (--enums=String), np. ..._LARGE
      details: `No free ${size} compartment in ${lockerId}`,
    });
    compartment.free = false; // zmiana stanu: skrytka zajęta
    reservations += 1;
    // Pierwszy kod po starcie serwera to 480001.
    const pickupCode = String(480000 + reservations);
    callback(null, { compartmentId: compartment.id, pickupCode });
  },
};

const server = new grpc.Server();
// addService łączy metody z pliku .proto z handlerami o tych nazwach.
server.addService(lockersPackage.lockers.v1.LockerService.service, handlers);

// 0.0.0.0 = wszystkie interfejsy; createInsecure() = bez TLS.
const credentials = grpc.ServerCredentials.createInsecure();
server.bindAsync("0.0.0.0:50061", credentials, (error) => {
  if (error) throw error; // np. port zajęty: proces się kończy
  console.log("LockerService on port 50061");
});
