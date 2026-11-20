// Jedna skrytka zakodowana bez serwera: klucz do bajtów odpowiedzi GetLocker.
// Liczby w niej są mniejsze niż 128, więc każda zajmuje jeden bajt.
import { lockersPackage } from "./proto.ts";

// serialize koduje obiekt tą samą definicją z .proto, której grpc-js
// używa przy odpowiedzi serwera; wynik to Buffer z bajtami.
const bytes = lockersPackage.lockers.v1.Compartment.serialize({
  id: "WAW01-1", // pole 1, napis: tag, długość i bajty ASCII
  size: "COMPARTMENT_SIZE_SMALL", // pole 2, enum: idzie numer 1, nie nazwa
  free: true, // pole 3, bool: idzie liczba 1
});
// 26 cyfr szesnastkowych = 13 bajtów, bez żadnej nazwy pola.
console.log(bytes.toString("hex")); // → 0a0757415730312d3110011801
