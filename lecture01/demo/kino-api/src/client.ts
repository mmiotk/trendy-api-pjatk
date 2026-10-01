// Client for the "repertuar dnia" screen — built on Node's built-in fetch.
// Every variant below builds the SAME screen; only the number of requests
// and the shape of the response changes. Run the server first (npm run dev),
// then: npm run client
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const DATE = process.env.DATE ?? "2026-09-25";

interface Metrics {
  requests: number;
  bytes: number;
}

async function timedFetch(url: string, metrics: Metrics, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  const text = await res.text();
  metrics.requests += 1;
  metrics.bytes += Buffer.byteLength(text, "utf8");
  if (!res.ok) {
    throw new Error(`${res.status} ${url}: ${text}`);
  }
  return JSON.parse(text);
}

// v1 — naive client: one request for the list, then one request per movie
// and one per room, exactly as a straightforward implementation would do it
// before anyone measures the cost. No deduplication of repeated IDs.
async function fetchRepertoireNaive() {
  const metrics: Metrics = { requests: 0, bytes: 0 };
  const start = performance.now();

  const list = await timedFetch(`${BASE}/screenings?date=${DATE}`, metrics);
  const movieFetches = list.data.map((s: any) => timedFetch(`${BASE}/movies/${s.movieId}`, metrics));
  const roomFetches = list.data.map((s: any) => timedFetch(`${BASE}/rooms/${s.roomId}`, metrics));
  const movies = await Promise.all(movieFetches);
  const rooms = await Promise.all(roomFetches);

  const screen = list.data.map((s: any, i: number) => ({
    startTime: s.startTime,
    availableSeats: s.seatsTotal - s.seatsReserved,
    movieTitle: movies[i].title,
    roomName: rooms[i].name,
  }));

  return { screen, metrics, elapsedMs: performance.now() - start };
}

// v1b — the same 17 requests, but with await inside a loop: every request
// waits for the previous one, although none of them depends on another.
async function fetchRepertoireSequential() {
  const metrics: Metrics = { requests: 0, bytes: 0 };
  const start = performance.now();

  const list = await timedFetch(`${BASE}/screenings?date=${DATE}`, metrics);
  const screen: object[] = [];
  for (const s of list.data) {
    const movie = await timedFetch(`${BASE}/movies/${s.movieId}`, metrics);
    const room = await timedFetch(`${BASE}/rooms/${s.roomId}`, metrics);
    screen.push({
      startTime: s.startTime,
      availableSeats: s.seatsTotal - s.seatsReserved,
      movieTitle: movie.title,
      roomName: room.name,
    });
  }

  return { screen, metrics, elapsedMs: performance.now() - start };
}

// v2 — endpoint tailored for this screen: one request, exactly the fields
// the UI uses.
async function fetchRepertoireAggregated() {
  const metrics: Metrics = { requests: 0, bytes: 0 };
  const start = performance.now();
  const result = await timedFetch(`${BASE}/repertoire?date=${DATE}`, metrics);
  return { screen: result.data, metrics, elapsedMs: performance.now() - start };
}

// v3 — generic REST fix #1: include=movie,room embeds full related objects.
// One request, but every field of Movie and Room travels over the wire.
async function fetchRepertoireInclude() {
  const metrics: Metrics = { requests: 0, bytes: 0 };
  const start = performance.now();
  const result = await timedFetch(`${BASE}/screenings?date=${DATE}&include=movie,room`, metrics);
  return { screen: result.data, metrics, elapsedMs: performance.now() - start };
}

// v4 — generic REST fix #2: include + fields (sparse fieldset). One request,
// smaller payload — but availableSeats is NOT a real field of the resource,
// so the client must request seatsTotal/seatsReserved and compute it itself.
async function fetchRepertoireIncludeFields() {
  const metrics: Metrics = { requests: 0, bytes: 0 };
  const start = performance.now();
  const fields = "id,startTime,seatsTotal,seatsReserved,priceCents,movie.title,movie.durationMinutes,room.name";
  const result = await timedFetch(
    `${BASE}/screenings?date=${DATE}&include=movie,room&fields=${fields}`,
    metrics,
  );
  return { screen: result.data, metrics, elapsedMs: performance.now() - start };
}

function report(label: string, r: { metrics: Metrics; elapsedMs: number }) {
  console.log(
    `${label.padEnd(28)} requests=${String(r.metrics.requests).padStart(2)}  bytes=${String(r.metrics.bytes).padStart(5)}  time=${r.elapsedMs.toFixed(1)}ms`,
  );
}

// Warm-up: one uncounted pass of the naive client. The first fetches in a
// fresh Node process also pay for starting the HTTP client and opening new
// connections — without this pass that cost lands on the first variant.
await fetchRepertoireNaive();

const naive = await fetchRepertoireNaive();
report("naive (N+1)", naive);

const sequential = await fetchRepertoireSequential();
report("naive, await in a loop", sequential);

const aggregated = await fetchRepertoireAggregated();
report("/repertoire (dedicated)", aggregated);

const included = await fetchRepertoireInclude();
report("include=movie,room", included);

const includedFields = await fetchRepertoireIncludeFields();
report("include+fields", includedFields);

console.log("\nScreen built by the naive client (first two rows):");
console.log(naive.screen.slice(0, 2));
