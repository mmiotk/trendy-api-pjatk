import { getLocker } from "./data.ts";

// Wywołanie lokalne: ten sam proces, ta sama pamięć, brak sieci i brak możliwości awarii połączenia.
console.log(getLocker("WAW01")?.city);
console.log(getLocker("WAW99"));
