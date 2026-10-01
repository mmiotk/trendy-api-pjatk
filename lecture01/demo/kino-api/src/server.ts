// REST API for the "Kino: repertuar dnia" demo — Express 5 on Node 24,
// TypeScript stripped natively at runtime (no build step).
import express from "express";
import type { Request, Response, NextFunction } from "express";
import {
  movies,
  rooms,
  screenings,
  reservations,
  reports,
  findMovie,
  findRoom,
  findScreening,
  nextId,
  delay,
  type Screening,
  type SalesReport,
} from "./data.ts";

const app = express();
app.use(express.json());

// A message is payload + metadata. Without "Content-Type: application/json"
// express.json() leaves req.body undefined, so such bodies are rejected here.
app.use((req: Request, res: Response, next: NextFunction) => {
  if ((req.method === "POST" || req.method === "PATCH") && !req.is("application/json")) {
    res.status(415).json({ error: "Content-Type must be application/json" });
    return;
  }
  next();
});

// Artificial network delay applied to every response — makes request-count
// and byte-count differences show up as visible, repeatable time differences.
// Override with NETWORK_DELAY_MS=0 to see the "everything on localhost" case.
const NETWORK_DELAY_MS = Number(process.env.NETWORK_DELAY_MS ?? 40);
app.use((_req: Request, _res: Response, next: NextFunction) => {
  setTimeout(next, NETWORK_DELAY_MS);
});

// How long the sales report takes to "compute" — same constant is used by
// the blocking and the 202-Accepted endpoint, so the two are comparable.
const REPORT_DELAY_MS = Number(process.env.REPORT_DELAY_MS ?? 4000);

// ---------------------------------------------------------------------------
// Movies
// ---------------------------------------------------------------------------

app.get("/movies", (_req: Request, res: Response) => {
  res.json({ data: movies });
});

app.get("/movies/:id", (req: Request, res: Response) => {
  const movie = findMovie(Number(req.params.id));
  if (!movie) {
    res.status(404).json({ error: "movie not found" });
    return;
  }
  res.json(movie);
});

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

app.get("/rooms", (_req: Request, res: Response) => {
  res.json({ data: rooms });
});

app.get("/rooms/:id", (req: Request, res: Response) => {
  const room = findRoom(Number(req.params.id));
  if (!room) {
    res.status(404).json({ error: "room not found" });
    return;
  }
  res.json(room);
});

// ---------------------------------------------------------------------------
// Screenings — filtering, field shaping (include/fields), pagination
// ---------------------------------------------------------------------------

// Field-based filtering: every criterion is its own query param with its own check.
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

app.get("/screenings", (req: Request, res: Response) => {
  let result = [...screenings].sort((a, b) => a.startTime.localeCompare(b.startTime));

  const date = req.query.date as string | undefined;
  if (date !== undefined && !DATE_PATTERN.test(date)) {
    res.status(400).json({ error: "date must look like YYYY-MM-DD" });
    return;
  }
  if (date) {
    result = result.filter((screening) => screening.startTime.startsWith(date));
  }

  const include = typeof req.query.include === "string" ? req.query.include.split(",") : [];
  const fields = typeof req.query.fields === "string" ? req.query.fields.split(",") : null;

  // Cursor pagination: opt in with cursor=true (first page) or after=<token>
  // (next pages). Kept as a separate mode from offset/limit on purpose, so
  // the two strategies can be compared on the exact same dataset.
  const after = req.query.after as string | undefined;
  if (after || req.query.cursor === "true") {
    const limit = Number(req.query.limit ?? 5);
    if (after) {
      const cursor = decodeCursor(after);
      result = result.filter((screening) => compareCursorKey(screening) > cursor);
    }
    const page = result.slice(0, limit);
    const nextCursor = page.length === limit ? encodeCursor(page[page.length - 1]!) : null;
    res.json({ data: page.map((s) => shapeScreening(s, include, fields)), next: nextCursor });
    return;
  }

  if (req.query.limit !== undefined || req.query.offset !== undefined) {
    const limit = Number(req.query.limit ?? 5);
    const offset = Number(req.query.offset ?? 0);
    const page = result.slice(offset, offset + limit);
    res.json({
      data: page.map((s) => shapeScreening(s, include, fields)),
      count: result.length,
      offset,
      limit,
    });
    return;
  }

  res.json({ data: result.map((s) => shapeScreening(s, include, fields)) });
});

function shapeScreening(screening: Screening, include: string[], fields: string[] | null) {
  const shaped: Record<string, unknown> = { ...screening };
  if (include.includes("movie")) {
    shaped.movie = findMovie(screening.movieId);
  }
  if (include.includes("room")) {
    shaped.room = findRoom(screening.roomId);
  }
  if (!fields) {
    return shaped;
  }
  const picked: Record<string, unknown> = {};
  for (const path of fields) {
    const [head, ...rest] = path.split(".");
    if (rest.length === 0) {
      picked[head!] = shaped[head!];
    } else {
      const nested = shaped[head!] as Record<string, unknown> | undefined;
      picked[head!] = { ...(picked[head!] as Record<string, unknown> | undefined), [rest.join(".")]: nested?.[rest.join(".")] };
    }
  }
  return picked;
}

// Cursor = base64("<startTime>|<id>"), matching Dynowski's opaque-token cursor.
function encodeCursor(screening: Screening): string {
  return Buffer.from(`${screening.startTime}|${screening.id}`).toString("base64url");
}
function decodeCursor(token: string): string {
  return Buffer.from(token, "base64url").toString("utf8");
}
function compareCursorKey(screening: Screening): string {
  return `${screening.startTime}|${String(screening.id).padStart(6, "0")}`;
}

app.get("/screenings/:id", (req: Request, res: Response) => {
  const screening = findScreening(Number(req.params.id));
  if (!screening) {
    res.status(404).json({ error: "screening not found" });
    return;
  }
  // Level 3 (HATEOAS) as an opt-in experiment, not the default contract.
  if (req.query.hateoas === "true") {
    res.json({
      ...screening,
      _links: {
        self: { href: `/screenings/${screening.id}`, method: "GET" },
        reserve: { href: `/screenings/${screening.id}/reservations`, method: "POST" },
        movie: { href: `/movies/${screening.movieId}`, method: "GET" },
        room: { href: `/rooms/${screening.roomId}`, method: "GET" },
      },
    });
    return;
  }
  res.json(screening);
});

app.post("/screenings", (req: Request, res: Response) => {
  const { movieId, roomId, startTime, priceCents, seatsTotal } = req.body;
  if (!findMovie(movieId) || !findRoom(roomId)) {
    res.status(400).json({ error: "unknown movieId or roomId" });
    return;
  }
  const screening: Screening = {
    id: nextId(screenings),
    movieId,
    roomId,
    startTime,
    priceCents,
    seatsTotal,
    seatsReserved: 0,
    createdAt: new Date().toISOString(),
    notes: "dodano w trakcie sprzedazy",
  };
  screenings.push(screening);
  res.status(201).location(`/screenings/${screening.id}`).json(screening);
});

// ---------------------------------------------------------------------------
// Repertoire — the endpoint tailored for the "repertuar dnia" screen
// ---------------------------------------------------------------------------

app.get("/repertoire", (req: Request, res: Response) => {
  const date = req.query.date as string | undefined;
  if (date === undefined || !DATE_PATTERN.test(date)) {
    res.status(400).json({ error: "date must look like YYYY-MM-DD" });
    return;
  }
  const data = screenings
    .filter((screening) => screening.startTime.startsWith(date))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((screening) => {
      const movie = findMovie(screening.movieId)!;
      const room = findRoom(screening.roomId)!;
      return {
        screeningId: screening.id,
        startTime: screening.startTime,
        priceCents: screening.priceCents,
        availableSeats: screening.seatsTotal - screening.seatsReserved,
        movieTitle: movie.title,
        movieDurationMinutes: movie.durationMinutes,
        roomName: room.name,
      };
    });
  res.json({ data });
});

// ---------------------------------------------------------------------------
// Reservations — resource-oriented (PATCH) vs intent-oriented (POST) on the
// same underlying operation: reserve seats on a screening.
// ---------------------------------------------------------------------------

// Resource-oriented: the client reads the current seat count, computes the
// new absolute value, and PATCHes the resource back. Classic lost-update
// shape — two clients racing on the same GET-then-PATCH round trip can both
// "win" and overwrite each other.
app.patch("/screenings/:id", (req: Request, res: Response) => {
  const screening = findScreening(Number(req.params.id));
  if (!screening) {
    res.status(404).json({ error: "screening not found" });
    return;
  }
  const { seatsReserved } = req.body;
  if (typeof seatsReserved !== "number") {
    res.status(400).json({ error: "seatsReserved must be a number" });
    return;
  }
  if (seatsReserved > screening.seatsTotal || seatsReserved < 0) {
    res.status(409).json({ error: "seatsReserved out of range" });
    return;
  }
  screening.seatsReserved = seatsReserved;
  res.json(screening);
});

// Intent-oriented: the client states the goal ("reserve N seats"), the
// server owns the invariant and applies it as a delta, atomically, with no
// I/O between the capacity check and the write — no lost update is possible.
app.post("/screenings/:id/reservations", (req: Request, res: Response) => {
  const screening = findScreening(Number(req.params.id));
  if (!screening) {
    res.status(404).json({ error: "screening not found" });
    return;
  }
  const { seatCount, customerName } = req.body;
  if (typeof seatCount !== "number" || seatCount <= 0) {
    res.status(400).json({ error: "seatCount must be a positive number" });
    return;
  }
  const availableSeats = screening.seatsTotal - screening.seatsReserved;
  if (seatCount > availableSeats) {
    res.status(409).json({ error: "not enough seats available", availableSeats });
    return;
  }
  screening.seatsReserved += seatCount;
  const reservation = {
    id: nextId(reservations),
    screeningId: screening.id,
    seatCount,
    customerName: typeof customerName === "string" ? customerName : "anonim",
    createdAt: new Date().toISOString(),
  };
  reservations.push(reservation);
  res.status(201).location(`/reservations/${reservation.id}`).json(reservation);
});

app.get("/reservations/:id", (req: Request, res: Response) => {
  const reservation = reservations.find((r) => r.id === Number(req.params.id));
  if (!reservation) {
    res.status(404).json({ error: "reservation not found" });
    return;
  }
  res.json(reservation);
});

// ---------------------------------------------------------------------------
// Sales report — synchronous (blocking) vs 202 Accepted (long-running task)
// ---------------------------------------------------------------------------

app.get("/reports/sales-sync", async (req: Request, res: Response) => {
  const date = (req.query.date as string | undefined) ?? "";
  await delay(REPORT_DELAY_MS);
  const { totalRevenueCents, ticketsSold } = computeSales(date);
  res.json({ date, totalRevenueCents, ticketsSold, generatedAt: new Date().toISOString() });
});

function computeSales(date: string): { totalRevenueCents: number; ticketsSold: number } {
  const todays = screenings.filter((screening) => screening.startTime.startsWith(date));
  const totalRevenueCents = todays.reduce((sum, s) => sum + s.seatsReserved * s.priceCents, 0);
  const ticketsSold = todays.reduce((sum, s) => sum + s.seatsReserved, 0);
  return { totalRevenueCents, ticketsSold };
}

app.post("/reports", (req: Request, res: Response) => {
  const date = req.body.date as string;
  const report: SalesReport = {
    id: nextId(reports),
    date,
    status: "pending",
    totalRevenueCents: null,
    ticketsSold: null,
    requestedAt: new Date().toISOString(),
    completedAt: null,
  };
  reports.push(report);
  setTimeout(() => {
    const { totalRevenueCents, ticketsSold } = computeSales(date);
    report.status = "done";
    report.totalRevenueCents = totalRevenueCents;
    report.ticketsSold = ticketsSold;
    report.completedAt = new Date().toISOString();
  }, REPORT_DELAY_MS);
  res.status(202).location(`/reports/${report.id}`).json({ id: report.id, status: report.status });
});

app.get("/reports/:id", (req: Request, res: Response) => {
  const report = reports.find((r) => r.id === Number(req.params.id));
  if (!report) {
    res.status(404).json({ error: "report not found" });
    return;
  }
  res.json(report);
});

// ---------------------------------------------------------------------------
// Errors — one JSON shape for every error, including those Express creates
// ---------------------------------------------------------------------------

// No route matched: answer like every other 404 in this API, not with HTML.
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "route not found", method: req.method, path: req.path });
});

// Error handler — Express recognises it by its four parameters. Errors from
// express.json() and from handlers land here. The client gets a short JSON
// message without a stack trace; the full error goes to the server log.
app.use((err: Error & { status?: number; expose?: boolean }, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const status = err.status ?? 500;
  res.status(status).json({ error: err.expose ? err.message : "internal server error" });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`kino-api listening on http://localhost:${port} (NETWORK_DELAY_MS=${NETWORK_DELAY_MS})`);
});
