import { readFileSync } from "node:fs";
import { createSchema } from "graphql-yoga";
import { concerts, performers, stages, type Genre } from "./data.ts";
import { dateTime } from "./datetime.ts";

// Cały schemat leży w pliku SDL; ten plik dokłada do niego funkcje.
// `readFileSync` wczytuje plik od razu i zwraca jego treść jako tekst, czyli schemat w SDL.
const typeDefs = readFileSync("schema/festival.graphql", "utf8");

// Typ TypeScripta odpowiada `input ConcertFilter` z SDL; `?` oznacza pole opcjonalne, jak brak `!`.
interface ConcertFilter {
  stageId?: string;
  titleContains?: string;
  genre?: Genre;
  // Po konwersji skalara filtr zawiera już obiekt `Date`, a nie napis z JSON-a.
  from?: Date;
  performer?: { bandId?: string; soloArtistId?: string };
}

// Bez filtra (`= {}`) żaden warunek nie jest ustawiony, więc funkcja zwraca wszystkie koncerty.
function filterConcerts(filter: ConcertFilter = {}) {
  const { stageId, titleContains, genre, from, performer } = filter;
  // `?.` nie rzuca błędu, gdy pominięto `performer`.
  // `@oneOf` gwarantuje jedno id, a `??` bierze to, które istnieje.
  const performerId = performer?.bandId ?? performer?.soloArtistId;
  return concerts
    // Każdy filtr przepuszcza koncert, gdy warunek nie został podany albo jest spełniony.
    .filter((c) => !stageId || c.stage.id === stageId)
    .filter((c) => !titleContains || c.title.toLowerCase().includes(titleContains.toLowerCase()))
    // Porównanie z wartością z danych (`"jazz"`): mapa enuma już zamieniła `JAZZ` na tę wartość.
    .filter((c) => !genre || c.genre === genre)
    // Dane trzymają `startsAt` jako napis, więc zamieniamy go na `Date`, żeby porównać go z `from`.
    .filter((c) => !from || new Date(c.startsAt) >= from)
    .filter((c) => !performerId || c.performer.id === performerId);
}

const MAX_PAGE_SIZE = 20;

// Kursor to id koncertu zapisany w base64url, żeby klient nie traktował go jak czytelnej wartości.
const encodeCursor = (id: string) => Buffer.from(id).toString("base64url");
const decodeCursor = (cursor: string) => Buffer.from(cursor, "base64url").toString();

// Resolvery są najprostsze z możliwych: zwracają obiekty z pamięci,
// a pozostałe pola GraphQL czyta z tych obiektów po nazwie.
const resolvers = {
  // Klucz o nazwie skalara dołącza do `scalar DateTime` trzy funkcje z `datetime.ts`.
  DateTime: dateTime,
  // Klucz to nazwa z SDL, wartość to ta z danych: klient pisze `JAZZ`, resolvery dostają `"jazz"`.
  Genre: { ROCK: "rock", JAZZ: "jazz", ELECTRONIC: "electronic", FOLK: "folk" },
  // Typ abstrakcyjny nie zna typu konkretnego, więc rozpoznajemy go po polach obiektu.
  Performer: {
    // `__resolveType` zwraca nazwę typu konkretnego jako napis; po niej serwer wybiera pola do odpowiedzi.
    // Tylko zespół ma tablicę `members`, więc jej obecność odróżnia `Band` od `SoloArtist`.
    __resolveType: (obj: object) => ("members" in obj ? "Band" : "SoloArtist"),
  },
  SearchResult: {
    // Unia też potrzebuje `__resolveType`; typy są trzy, więc sprawdzamy ich charakterystyczne pola.
    __resolveType: (obj: object) => ("members" in obj ? "Band" : "instrument" in obj ? "SoloArtist" : "Stage"),
  },
  Query: {
    // Klucz `Query` odpowiada typowi ze schematu, a `stages` jego polu. Funkcja zwraca tablicę z pamięci;
    // GraphQL sam wybierze z tych obiektów pola, o które pytał klient.
    stages: () => stages,
    // `args` to argumenty pola, tu `id` z zapytania. Pierwszy parametr (`_parent`) omówimy na wykładzie 04.
    // `?? null`: gdy `find` niczego nie znajdzie, zwracamy null; typ `Stage` bez `!` na to pozwala.
    stage: (_parent: unknown, args: { id: string }) => stages.find((s) => s.id === args.id) ?? null,
    concert: (_parent: unknown, args: { id: string }) => concerts.find((c) => c.id === args.id) ?? null,
    performers: () => performers,
    // Wykonawcy i sceny trafiają do jednej listy: to obiekty różnych typów, które łączy dopiero unia.
    search: (_parent: unknown, args: { text: string }) => {
      const text = args.text.toLowerCase();
      return [...performers, ...stages].filter((item) => item.name.toLowerCase().includes(text));
    },
    // Argument pola `filter` przychodzi w `args.filter`: jako obiekt albo undefined, gdy go pominięto.
    concerts: (_parent: unknown, args: { filter?: ConcertFilter }) => filterConcerts(args.filter),
    // `first` ma w SDL wartość domyślną 3, więc zawsze dociera jako liczba; `after` bywa pominięty.
    concertsPage: (_parent: unknown, args: { filter?: ConcertFilter; first: number; after?: string }) => {
      // Limit strony chroni serwer przed `first: 100000`.
      const first = Math.min(args.first, MAX_PAGE_SIZE);
      // Drugi klucz (id) utrzymuje kolejność stałą, gdy dwa koncerty zaczynają się o tej samej porze.
      const items = filterConcerts(args.filter).toSorted(
        (a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id),
      );
      // Zaczynamy tuż za koncertem, którego id kryje kursor `after`; bez `after` od początku listy.
      const start = args.after ? items.findIndex((c) => c.id === decodeCursor(args.after!)) + 1 : 0;
      const page = items.slice(start, start + first);
      return {
        // Każdy koncert dostaje kursor, czyli swoje id zakodowane w base64url.
        edges: page.map((node) => ({ node, cursor: encodeCursor(node.id) })),
        pageInfo: {
          // Następna strona istnieje, jeśli za bieżącym wycinkiem zostały jeszcze koncerty.
          hasNextPage: start + first < items.length,
          // Kursor ostatniego koncertu strony; klient wpisze go w `after`. Pusta strona: null.
          endCursor: page.length > 0 ? encodeCursor(page[page.length - 1].id) : null,
        },
      };
    },
  },
};

// `createSchema` z Yogi składa tekst SDL i resolvery w gotowy schemat, który serwer potrafi wykonywać.
export const schema = createSchema({ typeDefs, resolvers });
