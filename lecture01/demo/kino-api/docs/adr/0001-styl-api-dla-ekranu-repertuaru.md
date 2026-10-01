# ADR 0001 — styl API dla ekranu „repertuar dnia"

**Status:** przyjęta

## Kontekst

Ekran „repertuar dnia" pokazuje listę dzisiejszych seansów: tytuł filmu, czas trwania, nazwę sali,
godzinę rozpoczęcia, cenę i liczbę wolnych miejsc. Zmierzone warianty budowy tego ekranu na tym samym
API REST (`npm run client`, opóźnienie sieci `NETWORK_DELAY_MS=40`, 8 seansów na dziś, czas po jednym
nieliczonym przebiegu rozgrzewającym klienta):

| Wariant | Żądania | Bajty odpowiedzi | Czas |
|---|---|---|---|
| naiwny klient (`GET /screenings` + `GET /movies/:id` + `GET /rooms/:id` bez deduplikacji) | 17 | 4135 | 90,7 ms |
| `GET /repertoire?date=...` (endpoint pod ekran) | 1 | 1353 | 42,4 ms |
| `GET /screenings?include=movie,room` | 1 | 4271 | 42,3 ms |
| `GET /screenings?include=movie,room&fields=...` | 1 | 1445 | 42,3 ms |

Wariant naiwny płaci za opóźnienie sieci dwa razy po kolei, bo identyfikatory filmów i sal poznaje
dopiero z listy seansów. Z 8 pól zasobu `Movie` ekran wyświetla 2 (`title`, `durationMinutes`). Z 5 pól
`Room` wyświetla 1 (`name`). Z 9 pól `Screening` wyświetla 4 (`startTime`, `priceCents`, `seatsTotal`,
`seatsReserved`) — `createdAt` i `notes` nie trafiają na ekran w żadnym wariancie. `include=movie,room`
nie zmniejsza liczby bajtów względem wariantu naiwnego (4271 vs 4135) — nadal przenosi pełne,
niezdeduplikowane zasoby, tylko w jednym żądaniu zamiast siedemnastu. `fields=...` obniża bajty (1445),
ale działa wyłącznie na dosłownych nazwach pól zasobu: `availableSeats` nie istnieje jako pole
`Screening` (to `seatsTotal - seatsReserved`), więc klient musi pobrać oba składniki i policzyć różnicę
sam.

## Decyzja

Dla ekranu „repertuar dnia" API REST dostaje dedykowany endpoint `GET /repertoire?date=...`, a nie
ogólny mechanizm `include`/`fields` na `/screenings`. Endpoint zwraca dokładnie te pola, których ekran
używa, policzone po stronie serwera (w tym `availableSeats`).

## Konsekwencje

- Ekran wykonuje 1 żądanie zamiast 17, płaci 1353 z 4135 bajtów wariantu naiwnego.
- Endpoint jest sprzężony z jednym ekranem — kolejny ekran (np. „szczegóły seansu z obsadą") potrzebuje
  własnego endpointu albo własnej kombinacji `include`/`fields`, co przy wielu ekranach mnoży liczbę
  wariantów odpowiedzi API. Ten problem rozwiązuje styl zapytaniowy
  (GraphQL): jeden endpoint, kształt odpowiedzi zależny od zapytania klienta, bez mnożenia endpointów.
- Rezerwacja miejsca na tym samym API używa stylu API intencji (`POST /screenings/:id/reservations`),
  nie stylu zasobowego (`PATCH /screenings/:id`) — pomiar (`npm run reserve-demo`) pokazał na tym samym
  kodzie utratę jednej rezerwacji przy stylu zasobowym (dwóch klientów czyta `seatsReserved=78`, oboje
  zapisuje `79`) i poprawne odrzucenie nadmiarowej rezerwacji (`409`) przy stylu intencji.
- Lista seansów tygodnia (widok administracyjny, poza ekranem „repertuar dnia") używa paginacji
  kursorowej, nie offsetowej — pomiar (`npm run pagination-demo`) odtworzył duplikat rekordu przy
  paginacji offsetowej w chwili dodania nowego seansu w trakcie przeglądania i brak takiej anomalii przy
  kursorze.
- Raport sprzedaży dnia (operacja długotrwała, `REPORT_DELAY_MS=4000`) używa wzorca `202 Accepted` +
  odpytywanie statusu, nie pojedynczego blokującego żądania — pomiar (`npm run report-demo`) pokazał
  przerwanie blokującego żądania przez limit czasu klienta ustawiony na 2 s, podczas gdy wariant
  asynchroniczny zwraca `202` po 46 ms niezależnie od czasu trwania obliczeń.
