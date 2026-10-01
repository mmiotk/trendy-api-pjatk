// In-memory data store for the "Kino: repertuar dnia" demo.
// No database on purpose (lecture 01 scope) — plain arrays, mutated directly,
// reset every time the server restarts.

export interface Movie {
  id: number;
  title: string;
  durationMinutes: number;
  genre: string;
  ageRating: string;
  director: string;
  synopsis: string;
  cast: string[];
}

export interface Room {
  id: number;
  name: string;
  capacitySeats: number;
  screenType: string;
  location: string;
}

export interface Screening {
  id: number;
  movieId: number;
  roomId: number;
  startTime: string; // ISO 8601, e.g. "2026-09-25T14:00:00"
  priceCents: number;
  seatsTotal: number;
  seatsReserved: number;
  createdAt: string;
  notes: string;
}

export interface Reservation {
  id: number;
  screeningId: number;
  seatCount: number;
  customerName: string;
  createdAt: string;
}

export interface SalesReport {
  id: number;
  date: string;
  status: "pending" | "done";
  totalRevenueCents: number | null;
  ticketsSold: number | null;
  requestedAt: string;
  completedAt: string | null;
}

// Fixed "today" for the demo — independent of the real system clock, so the
// numbers in POMIARY.md stay reproducible no matter when the demo is run.
export const TODAY = "2026-09-25";

export const movies: Movie[] = [
  {
    id: 1,
    title: "Ostatni lot do Warszawy",
    durationMinutes: 178,
    genre: "dramat",
    ageRating: "12+",
    director: "M. Kowalska",
    synopsis:
      "Kontroler lotów musi sprowadzić samolot na ziemię, gdy traci łączność z wieżą w trakcie burzy.",
    cast: ["A. Nowak", "P. Zielinski", "K. Wisniewska"],
  },
  {
    id: 2,
    title: "Cichy dom",
    durationMinutes: 96,
    genre: "horror",
    ageRating: "16+",
    director: "T. Baran",
    synopsis: "Rodzina wprowadza się do domu, w którym nikt nie zostaje dłużej niż tydzień.",
    cast: ["J. Lewandowski", "M. Duda"],
  },
  {
    id: 3,
    title: "Podwodny świat",
    durationMinutes: 102,
    genre: "familijny",
    ageRating: "b/o",
    director: "R. Mazur",
    synopsis: "Animacja o rybce, która odkrywa zatopione miasto pod rafą koralową.",
    cast: ["głosy: E. Kaczmarek, S. Wojcik"],
  },
  {
    id: 4,
    title: "Kod czerwony",
    durationMinutes: 121,
    genre: "akcja",
    ageRating: "15+",
    director: "D. Sikora",
    synopsis: "Agentka wywiadu ma 24 godziny, by powstrzymać atak na sieć energetyczną kraju.",
    cast: ["B. Krawczyk", "N. Piotrowska", "W. Adamski"],
  },
  {
    id: 5,
    title: "Zanim zapomnisz",
    durationMinutes: 108,
    genre: "komedia romantyczna",
    ageRating: "12+",
    director: "A. Michalska",
    synopsis: "Dwoje nieznajomych umawia się co roku w tym samym miejscu, nie pamiętając dlaczego.",
    cast: ["K. Gorski", "M. Jablonska"],
  },
];

export const rooms: Room[] = [
  { id: 1, name: "Sala 1", capacitySeats: 120, screenType: "2D", location: "parter" },
  { id: 2, name: "Sala 2", capacitySeats: 80, screenType: "3D", location: "parter" },
  { id: 3, name: "Sala VIP", capacitySeats: 40, screenType: "2D", location: "pietro" },
];

// Screenings are listed in startTime order on purpose — the pagination demo
// (segment 5) relies on that order to reproduce the offset-vs-cursor anomaly.
export const screenings: Screening[] = [
  mkScreening(1, 1, 1, `${TODAY}T14:00:00`, 2400, 120, 45),
  mkScreening(2, 2, 2, `${TODAY}T14:30:00`, 2000, 80, 78),
  mkScreening(3, 3, 3, `${TODAY}T15:00:00`, 3200, 40, 10),
  mkScreening(4, 4, 1, `${TODAY}T17:30:00`, 2400, 120, 60),
  mkScreening(5, 5, 2, `${TODAY}T18:00:00`, 2000, 80, 20),
  mkScreening(6, 1, 3, `${TODAY}T19:00:00`, 3200, 40, 5),
  mkScreening(7, 2, 1, `${TODAY}T20:30:00`, 2400, 120, 100),
  mkScreening(8, 4, 2, `${TODAY}T21:00:00`, 2000, 80, 30),
  mkScreening(9, 3, 1, "2026-09-26T14:00:00", 2400, 120, 12),
  mkScreening(10, 5, 2, "2026-09-26T16:30:00", 2000, 80, 8),
  mkScreening(11, 1, 3, "2026-09-26T19:00:00", 3200, 40, 15),
  mkScreening(12, 2, 1, "2026-09-27T15:00:00", 2400, 120, 6),
  mkScreening(13, 4, 2, "2026-09-27T17:30:00", 2000, 80, 22),
  mkScreening(14, 5, 3, "2026-09-27T20:00:00", 3200, 40, 4),
];

export const reservations: Reservation[] = [];
export const reports: SalesReport[] = [];

function mkScreening(
  id: number,
  movieId: number,
  roomId: number,
  startTime: string,
  priceCents: number,
  seatsTotal: number,
  seatsReserved: number,
): Screening {
  return {
    id,
    movieId,
    roomId,
    startTime,
    priceCents,
    seatsTotal,
    seatsReserved,
    createdAt: "2026-09-01T09:00:00",
    notes: "brak uwag",
  };
}

export function nextId(items: { id: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

export function findMovie(id: number): Movie | undefined {
  return movies.find((movie) => movie.id === id);
}

export function findRoom(id: number): Room | undefined {
  return rooms.find((room) => room.id === id);
}

export function findScreening(id: number): Screening | undefined {
  return screenings.find((screening) => screening.id === id);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
