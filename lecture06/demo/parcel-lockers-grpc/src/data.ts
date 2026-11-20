// Nazwy jak wartości przyszłego enuma w pliku .proto
export type Size =
  | "COMPARTMENT_SIZE_SMALL"
  | "COMPARTMENT_SIZE_MEDIUM"
  | "COMPARTMENT_SIZE_LARGE";

export interface Compartment {
  id: string; // np. WAW01-1
  size: Size;
  free: boolean; // false = zajęta
}

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

export function getLocker(id: string): Locker | undefined {
  return lockers.find((locker) => locker.id === id); // "WAW99": undefined
}
