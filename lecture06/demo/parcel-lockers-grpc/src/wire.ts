import { lockersPackage } from "./proto.ts";

// Skrytka zamieniona na bajty (Buffer) tą samą definicją, której używa serwer.
const bytes = lockersPackage.lockers.v1.Compartment.serialize({ id: "WAW01-1", size: "COMPARTMENT_SIZE_SMALL", free: true });
console.log(bytes.toString("hex")); // cały komunikat szesnastkowo, dwie cyfry na bajt

// Rekord po rekordzie: tag, potem wartość. W tej skrytce każdy tag, długość i liczba mieszczą się w jednym bajcie.
// Pełny dekoder czytałby każdą z tych liczb jako varint, w pętli aż do bajtu z bitem kontynuacji 0.
for (let i = 0; i < bytes.length; ) {
  const tag = bytes[i];
  const field = tag >> 3; // numer pola: bity od trzeciego w górę, np. 0x18 >> 3 daje 3
  const wireType = tag & 7; // typ przewodowy: trzy najmłodsze bity, np. 0x18 & 7 daje 0
  if (wireType === 0) {
    // typ 0 (varint): po tagu stoi sama liczba
    console.log(`tag ${tag.toString(16).padStart(2, "0")}: field ${field}, wire type 0, value ${bytes[i + 1]}`);
    i += 2; // przeskok za tag i jednobajtową liczbę
  } else {
    // typ 2 (długość): po tagu stoi długość, a po niej tyle bajtów wartości
    const length = bytes[i + 1];
    const value = bytes.subarray(i + 2, i + 2 + length).toString(); // bajty wartości odczytane jako tekst UTF-8
    console.log(`tag ${tag.toString(16).padStart(2, "0")}: field ${field}, wire type 2, length ${length}, value "${value}"`);
    i += 2 + length; // przeskok za tag, bajt długości i wartość
  }
}
