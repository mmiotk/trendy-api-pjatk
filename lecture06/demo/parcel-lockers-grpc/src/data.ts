// Rozmiary mają nazwy wartości z przyszłego enuma w pliku .proto, więc serwer odeśle je bez mapowania.
export type Size = "COMPARTMENT_SIZE_SMALL" | "COMPARTMENT_SIZE_MEDIUM" | "COMPARTMENT_SIZE_LARGE";

export interface Compartment {
  id: string;
  size: Size;
  free: boolean;
}

export interface Locker {
  id: string;
  city: string;
  postalCode: string;
  compartments: Compartment[];
}

// Dane w pamięci procesu: dwa paczkomaty, w każdym skrytki trzech rozmiarów.
export const lockers: Locker[] = [
  {
    id: "WAW01",
    city: "Warsaw",
    postalCode: "00-001",
    compartments: [
      { id: "WAW01-1", size: "COMPARTMENT_SIZE_SMALL", free: true },
      { id: "WAW01-2", size: "COMPARTMENT_SIZE_MEDIUM", free: true },
      { id: "WAW01-3", size: "COMPARTMENT_SIZE_LARGE", free: false },
    ],
  },
  {
    id: "KRK01",
    city: "Krakow",
    postalCode: "30-001",
    compartments: [
      { id: "KRK01-1", size: "COMPARTMENT_SIZE_SMALL", free: true },
      { id: "KRK01-2", size: "COMPARTMENT_SIZE_MEDIUM", free: false },
      { id: "KRK01-3", size: "COMPARTMENT_SIZE_LARGE", free: true },
    ],
  },
];

export function getLocker(id: string): Locker | undefined {
  return lockers.find((locker) => locker.id === id);
}

// Przesyłki utworzone przez ShipmentService.
export const shipments: { id: string; compartmentId: string }[] = [];
