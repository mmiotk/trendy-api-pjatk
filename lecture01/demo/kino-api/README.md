# Kino: repertuar dnia — projekt referencyjny (wykład 01)

„Gotowa wersja" aplikacji budowanej na żywo na wykładzie 01. REST API repertuaru kina (filmy, sale,
seanse, rezerwacje, raporty sprzedaży) i klient mierzący koszt ekranu „repertuar dnia". TypeScript
uruchamiany bezpośrednio przez Node 24 (natywne usuwanie typów, brak builda). Motyw jest inny niż w
laboratorium („Rowery miejskie"): pojęcia przenosi się na własną aplikację, a nie przepisuje kino.

## Wymagania

Node.js ≥ 24 (sprawdzone na 24.18.0), npm. Zweryfikowane wersje pakietów: Express 5.2, TypeScript 7.0.

## Instalacja i uruchomienie

```bash
npm install
npm run typecheck   # tsc --noEmit — sama kontrola typów, bez emitowania plików
npm run dev          # serwer z auto-restartem: node --watch src/server.ts
# albo: npm start    # bez auto-restartu
```

Serwer nasłuchuje na `http://localhost:3000`. Sztuczne opóźnienie sieci (domyślnie 40 ms na żądanie)
ustawia się zmienną `NETWORK_DELAY_MS`; czas trwania raportu sprzedaży (domyślnie 4000 ms) — zmienną
`REPORT_DELAY_MS`.

W drugim terminalu, przy uruchomionym serwerze:

```bash
npm run client            # segmenty 2-3: N+1, await w pętli, endpoint dedykowany, include, fields
npm run reserve-demo       # segment 4: PATCH zasobu vs POST intencji na rezerwacji miejsca
npm run pagination-demo    # segment 5: paginacja offsetowa vs kursorowa
npm run report-demo        # segment 6: żądanie blokujące vs 202 Accepted + odpytywanie
```

Skrypty mutują dane w pamięci serwera (rezerwacje, dodane seanse). Liczby cytowane na slajdach
odtwarza się, uruchamiając je w tej kolejności na świeżo wystartowanym serwerze (`npm start`, bez
restartu między skryptami). `npm run dev` restartuje serwer po każdej zmianie `server.ts`, co zeruje dane w pamięci.
`client.ts` przed pomiarem wykonuje jeden nieliczony przebieg rozgrzewający, żeby koszt startu klienta
HTTP nie obciążał pierwszego wariantu.

## Struktura

```
src/
  data.ts              typy + dane w pamięci (movies, rooms, screenings, reservations, reports)
  server.ts             REST API — Express 5, rośnie przez segmenty 0-6 (format błędów: segment 4)
  client.ts              segmenty 2-3: pomiar żądań/bajtów/czasu dla ekranu "repertuar dnia"
  reserve-demo.ts        segment 4: PATCH zasobu vs POST intencji
  pagination-demo.ts     segment 5: offset vs kursor
  report-demo.ts         segment 6: sync vs 202 Accepted
docs/adr/
  0001-styl-api-dla-ekranu-repertuaru.md   ADR z segmentu 7, z liczbami z pomiarów
```

## Endpointy

| Metoda i ścieżka | Rola |
|---|---|
| `GET /movies`, `GET /movies/:id` | katalog filmów |
| `GET /rooms`, `GET /rooms/:id` | katalog sal |
| `GET /screenings` | lista seansów — filtr `date` (`YYYY-MM-DD`, inaczej `400`), `include=movie,room`, `fields=...`, paginacja `limit`+`offset` albo `limit`+`cursor=true`/`after=...` |
| `GET /screenings/:id` | pojedynczy seans |
| `POST /screenings` | nowy seans (używane przez `pagination-demo.ts` do symulacji dostawionego seansu) |
| `GET /repertoire?date=...` | endpoint dedykowany pod ekran „repertuar dnia" (`date` wymagane, `YYYY-MM-DD`) |
| `PATCH /screenings/:id` | rezerwacja jako edycja zasobu (`seatsReserved`) — styl zasobowy |
| `POST /screenings/:id/reservations` | rezerwacja jako intencja (`seatCount`, `customerName`) — styl intencji |
| `GET /reservations/:id` | odczyt rezerwacji |
| `GET /reports/sales-sync?date=...` | raport sprzedaży, żądanie blokujące |
| `POST /reports` | raport sprzedaży, wzorzec `202 Accepted` + `Location` |
| `GET /reports/:id` | status/wynik raportu |

Operacji `DELETE` API nie udostępnia, z decyzji, a nie przez pominięcie: seans z rezerwacjami nie znika
z repertuaru, a rezerwacja ma dane osobowe (`customerName`), więc jej usunięcie musiałoby być twarde.
Żądanie `DELETE` dostaje `404` jak każda nieznana trasa.

Każde żądanie `POST` i `PATCH` bez nagłówka `Content-Type: application/json` dostaje `415 Unsupported
Media Type`.

## Błędy

Każdy błąd ma treść JSON z polem `error`, także błędy tworzone przez Express:

| Sytuacja | Kod | Treść |
|---|---|---|
| błąd danych w endpoincie, np. za mało miejsc | `400`, `404`, `409`, `415` | `{"error":"not enough seats available","availableSeats":0}` |
| nieznana trasa albo metoda | `404` | `{"error":"route not found","method":"DELETE","path":"/screenings/1"}` |
| treść żądania nie jest poprawnym JSON | `400` | `{"error":"Expected property name or '}' in JSON at position 1 (line 1 column 2)"}` |
| błąd w kodzie serwera | `500` | `{"error":"internal server error"}` |

Odpowiedź nigdy nie zawiera śladu stosu; pełny błąd trafia do konsoli serwera. Kod `500` przy
`POST /screenings/:id/reservations` nie mówi, czy rezerwacja została zapisana, a API nie ma listy
rezerwacji seansu, z której klient mógłby to sprawdzić. Ponowione żądanie może utworzyć drugą rezerwację.
