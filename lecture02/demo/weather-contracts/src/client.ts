import type { components } from "./generated/weather.v1.d.ts";

type Reading = components["schemas"]["Reading"];

const BASE = process.env.BASE_URL ?? "http://localhost:4010";

for (const stationId of ["st-01", "st-02"]) {
  const res = await fetch(`${BASE}/stations/${stationId}/readings/latest`);
  const reading: Reading = await res.json();
  console.log(`${stationId}: ${reading.temperatureCelsius.toFixed(1)} °C`);
}
