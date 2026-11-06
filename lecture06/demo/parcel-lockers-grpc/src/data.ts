// Rozmiary mają nazwy wartości z przyszłego enuma w pliku .proto, więc serwer odeśle je bez mapowania.
export type Size = "COMPARTMENT_SIZE_SMALL" | "COMPARTMENT_SIZE_MEDIUM" | "COMPARTMENT_SIZE_LARGE";

export interface Compartment {
  id: string;
  size: Size;
  free: boolean;
}

export interface Locker {
  id: string;
  compartments: Compartment[];
}

// Dane w pamięci procesu: jeden paczkomat z trzema skrytkami, duża jest zajęta.
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

// Zwykła funkcja w tym samym procesie: nieznany identyfikator daje undefined.
export function getLocker(id: string): Locker | undefined {
  return lockers.find((locker) => locker.id === id);
}
