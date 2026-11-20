// Klient usługi skrytek. Wywołanie zdalne wygląda tu jak funkcja:
// await, obiekt na wejściu, obiekt na wyjściu; sieć ukrywa stub.
import { promisify } from "node:util";
import * as grpc from "@grpc/grpc-js";
import { attempt } from "./errors.ts";
import { lockersPackage } from "./proto.ts";

// Klasa z kontraktu: new tworzy kanał (połączenie HTTP/2) i stub,
// czyli obiekt z metodami GetLocker i ReserveCompartment.
const { LockerService } = lockersPackage.lockers.v1;
const credentials = grpc.credentials.createInsecure(); // jak serwer: bez TLS
const client = new LockerService("localhost:50061", credentials);

// Stub oddaje wynik przez callback; promisify zamienia go na obietnicę
// (można użyć await), a bind(client) zostawia metodzie stub jako this.
const getLocker = promisify(client.GetLocker).bind(client);
const reserveCompartment = promisify(client.ReserveCompartment).bind(client);

// Pięć wywołań jednym kanałem; attempt łapie błąd w catch,
// więc błąd nie przerywa programu.
await attempt("get WAW01", getLocker({ id: "WAW01" }));
await attempt("get WAW99", getLocker({ id: "WAW99" })); // nie ma w danych
await attempt("reserve small", reserveCompartment({
  lockerId: "WAW01", size: "COMPARTMENT_SIZE_SMALL", postalCode: "00-001",
}));
await attempt("reserve large", reserveCompartment({ // duża jest zajęta
  lockerId: "WAW01", size: "COMPARTMENT_SIZE_LARGE", postalCode: "00-001",
}));
// Bez size (wartość zero enuma) i zły kod pocztowy: dwa naruszenia.
await attempt("reserve without size", reserveCompartment({
  lockerId: "WAW01", postalCode: "0001",
}));
client.close();
