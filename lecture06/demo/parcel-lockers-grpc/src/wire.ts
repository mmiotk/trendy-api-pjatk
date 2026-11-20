import { lockersPackage } from "./proto.ts";

// Ta sama definicja komunikatu, której używa serwer.
const bytes = lockersPackage.lockers.v1.Compartment.serialize({
  id: "WAW01-1", size: "COMPARTMENT_SIZE_SMALL", free: true,
});
console.log(bytes.toString("hex")); // → 0a0757415730312d3110011801
