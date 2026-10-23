// Dane festiwalu w pamięci. Obiekty wskazują na siebie, więc dane już są grafem.
export interface Stage {
  id: string;
  name: string;
  location?: string; // nie każda scena ma ustalone miejsce
  // Relacja w danych: scena trzyma tablicę swoich koncertów, a koncert wskazuje swoją scenę.
  concerts: Concert[];
}

export interface Band {
  id: string;
  name: string;
  hometown?: string;
  members: string[];
  agentEmail: string; // pole wewnętrzne, którego schemat nie udostępnia
  concerts: Concert[];
}

export interface SoloArtist {
  id: string;
  name: string;
  instrument: string;
  agentEmail: string; // pole wewnętrzne, którego schemat nie udostępnia
  concerts: Concert[];
}

// Wykonawca to zespół albo solista: dwa różne kształty obiektów w jednej tablicy.
export type Performer = Band | SoloArtist;

// Gatunek zapisany jako napis małymi literami, jak w bazie.
export type Genre = "rock" | "jazz" | "electronic" | "folk";

export interface Concert {
  id: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  genre: Genre;
  stage: Stage;
  performer: Performer;
}

// Tablice `concerts` w scenach i u wykonawców startują puste; wypełnia je funkcja `schedule` niżej.
export const stages: Stage[] = [
  { id: "stage-main", name: "Main Stage", location: "West Meadow", concerts: [] },
  // Ta scena nie ma pola `location`: w odpowiedzi GraphQL pole będzie miało wartość null.
  { id: "stage-forest", name: "Forest Stage", concerts: [] },
];

export const performers: Performer[] = [
  { id: "band-granite", name: "Granite Bridges", hometown: "Gdansk", members: ["Eve", "Mark", "John"], agentEmail: "booking@granite.example", concerts: [] },
  { id: "band-neon", name: "Neon Autumn", members: ["Alice", "Tom"], agentEmail: "manager@neon.example", concerts: [] },
  { id: "solo-wrona", name: "Olivia Crow", instrument: "acoustic guitar", agentEmail: "ola@wrona.example", concerts: [] },
  { id: "solo-lis", name: "Peter Fox", instrument: "piano", agentEmail: "piotr@lis.example", concerts: [] },
];

export const concerts: Concert[] = [];

// Dodaje koncert i wpisuje go na scenę oraz do wykonawcy (relacje w obie strony).
function schedule(id: string, title: string, startsAt: string, durationMinutes: number, genre: Genre, stageId: string, performerId: string) {
  const stage = stages.find((s) => s.id === stageId)!;
  const performer = performers.find((p) => p.id === performerId)!;
  const concert: Concert = { id, title, startsAt, durationMinutes, genre, stage, performer };
  concerts.push(concert);
  stage.concerts.push(concert);
  performer.concerts.push(concert);
}

// Siedem koncertów na dwóch scenach; każde wywołanie łączy koncert ze sceną i wykonawcą.
schedule("c1", "Evening Thunder", "2026-07-10T18:00:00Z", 75, "rock", "stage-main", "band-granite");
schedule("c2", "Electric Fields", "2026-07-10T20:00:00Z", 90, "electronic", "stage-main", "band-neon");
schedule("c3", "Final Night", "2026-07-11T19:00:00Z", 80, "rock", "stage-main", "band-granite");
schedule("c4", "Piano by the River", "2026-07-10T18:00:00Z", 60, "jazz", "stage-forest", "solo-lis");
schedule("c5", "Jazz at Dusk", "2026-07-11T17:00:00Z", 60, "jazz", "stage-forest", "solo-lis");
schedule("c6", "Neons in the Forest", "2026-07-11T21:00:00Z", 120, "electronic", "stage-forest", "band-neon");
schedule("c7", "Campfire Songs", "2026-07-10T16:00:00Z", 45, "folk", "stage-forest", "solo-wrona");
