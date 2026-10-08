// In-memory data store for the "weather stations" demo.
// No database on purpose (contract is the topic, not persistence) — plain
// arrays, mutated directly, reset every time the server restarts.

export interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  elevationMeters: number;
}

export interface Reading {
  id: string;
  stationId: string;
  observedAt: string; // ISO 8601, e.g. "2026-09-25T09:00:00Z"
  temperatureCelsius: number;
}

export const stations: Station[] = [
  { id: "st-01", name: "Gdansk-Letnica", lat: 54.386, lon: 18.66, elevationMeters: 2 },
  { id: "st-02", name: "Zakopane-Kasprowy", lat: 49.232, lon: 19.982, elevationMeters: 1987 },
  { id: "st-03", name: "Warszawa-Bielany", lat: 52.286, lon: 20.934, elevationMeters: 105 },
];

export const readings: Reading[] = [
  { id: "rd-1001", stationId: "st-01", observedAt: "2026-09-25T08:00:00Z", temperatureCelsius: 13.8 },
  { id: "rd-1002", stationId: "st-01", observedAt: "2026-09-25T09:00:00Z", temperatureCelsius: 14.2 },
  { id: "rd-1003", stationId: "st-02", observedAt: "2026-09-25T09:00:00Z", temperatureCelsius: 3.5 },
  { id: "rd-1004", stationId: "st-03", observedAt: "2026-09-25T09:00:00Z", temperatureCelsius: 16.1 },
];

export function findStation(id: string): Station | undefined {
  return stations.find((station) => station.id === id);
}

export function latestReading(stationId: string): Reading | undefined {
  return readings
    .filter((reading) => reading.stationId === stationId)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
}

export function nextReadingId(): string {
  const maxNum = readings.reduce((max, reading) => {
    const num = Number(reading.id.replace("rd-", ""));
    return Number.isFinite(num) ? Math.max(max, num) : max;
  }, 1000);
  return `rd-${maxNum + 1}`;
}
