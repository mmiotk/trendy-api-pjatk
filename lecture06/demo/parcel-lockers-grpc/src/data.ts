// Typy i dane paczkomatu dla kodu w tym samym procesie. Inny proces
// ich nie zna: dla niego paczkomat opisuje plik .proto.

// Nazwy jak wartości przyszłego enuma w pliku .proto.
// Unia napisów, bo erasableSyntaxOnly nie przepuści enum TS.
export type Size =
  | "COMPARTMENT_SIZE_SMALL"
  | "COMPARTMENT_SIZE_MEDIUM"
  | "COMPARTMENT_SIZE_LARGE";

export interface Compartment {
  id: string; // np. WAW01-1
  size: Size;
  free: boolean; // false = zajęta
}

// Paczkomat ma skrytki trzech rozmiarów.
export interface Locker {
  id: string;
  compartments: Compartment[];
}

// Dane w pamięci procesu: restart przywraca ten stan.
export const lockers: Locker[] = [
  {
    id: "WAW01",
    compartments: [
      { id: "WAW01-1", size: "COMPARTMENT_SIZE_SMALL", free: true },
      { id: "WAW01-2", size: "COMPARTMENT_SIZE_MEDIUM", free: true },
      { id: "WAW01-3", size: "COMPARTMENT_SIZE_LARGE", free: false },
    ],
  },
];

// Wynik od razu, w tej samej pamięci. Jedyny „błąd” to nieznane id,
// a typ Locker | undefined każe kodowi wołającemu obsłużyć oba przypadki.
// Za siecią dochodzą awaria serwera i odpowiedź, która nie nadchodzi.
export function getLocker(id: string): Locker | undefined {
  return lockers.find((locker) => locker.id === id); // "WAW99": undefined
}
