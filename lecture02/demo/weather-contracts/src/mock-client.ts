// Client written against the MOCK server (Prism, port 4010) — BEFORE any
// real server code exists. Same shape of code will later talk to the real
// server on port 3000 (segment 2) — only BASE changes.
// Run: npm run mock (in one terminal), then npm run mock:client (in another).
const BASE = process.env.BASE_URL ?? "http://localhost:4010";

interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  elevationMeters: number;
}

interface Reading {
  id: string;
  stationId: string;
  observedAt: string;
  temperatureCelsius: number;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`${res.status} ${path}`);
  }
  return res.json() as Promise<T>;
}

const stationsResponse = await fetchJson<{ data: Station[] }>("/stations");
console.log(`stations from mock: ${stationsResponse.data.length}`);

for (const station of stationsResponse.data) {
  const reading = await fetchJson<Reading>(`/stations/${station.id}/readings/latest`);
  console.log(`${station.name.padEnd(20)} -> ${reading.temperatureCelsius}°C @ ${reading.observedAt}`);
}
