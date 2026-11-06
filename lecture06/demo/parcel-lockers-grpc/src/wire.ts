import protobuf from "protobufjs";
import { getLocker } from "./data.ts";

// Rozpisuje bajty komunikatu na pola: tag (numer pola i typ przewodowy), a potem wartość.
function explain(bytes: Uint8Array): void {
  console.log(Buffer.from(bytes).toString("hex"));
  const reader = protobuf.Reader.create(bytes);
  while (reader.pos < reader.len) {
    const start = reader.pos;
    const tag = reader.uint32();
    const tagBytes = Buffer.from(bytes.subarray(start, reader.pos)).toString("hex");
    const field = tag >>> 3; // numer pola to bity od trzeciego w górę
    const wireType = tag & 7; // typ przewodowy to trzy najmłodsze bity
    if (wireType === 0) {
      console.log(`  tag ${tagBytes}: field ${field}, wire type 0 (varint), value ${reader.uint32()}`);
    } else {
      const value = Buffer.from(reader.bytes()); // typ 2: długość (varint), potem tyle bajtów
      console.log(`  tag ${tagBytes}: field ${field}, wire type 2 (length-delimited), length ${value.length}, value ${value.toString("hex")}`);
    }
  }
}

const root = protobuf.loadSync("proto/lockers/v1/lockers.proto");
const Compartment = root.lookupType("lockers.v1.Compartment");

explain(Compartment.encode(Compartment.fromObject({ id: "WAW01-1", size: "COMPARTMENT_SIZE_SMALL", free: true })).finish());
// Obiekt nie ma pola `free`, więc koder go nie zapisuje; format pozwala pominąć też pole o wartości domyślnej.
explain(Compartment.encode(Compartment.fromObject({ id: "WAW01-3", size: "COMPARTMENT_SIZE_LARGE" })).finish());

// Mały komunikat pomocniczy: liczba większa niż 127 i pole o numerze 16.
const Demo = protobuf.parse(`
  syntax = "proto3";
  message Demo {
    int32 count = 2;
    string note = 16;
  }
`).root.lookupType("Demo");

explain(Demo.encode(Demo.fromObject({ count: 1, note: "hi" })).finish());
explain(Demo.encode(Demo.fromObject({ count: 300, note: "hi" })).finish());

// Komunikat zagnieżdżony to pole z typem 2: długość, a potem bajty komunikatu wewnętrznego.
const Locker = root.lookupType("lockers.v1.Locker");
explain(Locker.encode(Locker.fromObject(getLocker("KRK01")!)).finish());
