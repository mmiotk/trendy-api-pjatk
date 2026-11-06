import { lockersPackage } from "./proto.ts";

// Skrytka zamieniona na bajty tą samą definicją, której używa serwer.
const bytes = lockersPackage.lockers.v1.Compartment.serialize({ id: "WAW01-1", size: "COMPARTMENT_SIZE_SMALL", free: true });
console.log(bytes.toString("hex"));

// Rekord po rekordzie: tag, potem wartość. W tej skrytce każdy tag, długość i liczba mieszczą się w jednym bajcie.
for (let i = 0; i < bytes.length; ) {
  const tag = bytes[i];
  const field = tag >> 3; // numer pola: bity od trzeciego w górę
  const wireType = tag & 7; // typ przewodowy: trzy najmłodsze bity
  if (wireType === 0) {
    // typ 0 (varint): po tagu stoi sama liczba
    console.log(`tag ${tag.toString(16).padStart(2, "0")}: field ${field}, wire type 0, value ${bytes[i + 1]}`);
    i += 2;
  } else {
    // typ 2 (długość): po tagu stoi długość, a po niej tyle bajtów wartości
    const length = bytes[i + 1];
    const value = bytes.subarray(i + 2, i + 2 + length).toString();
    console.log(`tag ${tag.toString(16).padStart(2, "0")}: field ${field}, wire type 2, length ${length}, value "${value}"`);
    i += 2 + length;
  }
}
