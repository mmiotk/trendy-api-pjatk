// A "new" client, written against v2: reads `temperatureValue` + `unit`,
// posts a new reading with `temperatureValue` + `unit`. Used in segment 5
// against BOTH the v2 server (works) and the v1.1 server (breaks) on purpose.
// After segment 6 (versioning) both versions live behind ONE server on
// port 3000, told apart by path: /v1 vs /v2.
const BASE = process.env.BASE_URL ?? "http://localhost:3000/v2";

const res = await fetch(`${BASE}/stations/st-01/readings/latest`);
const reading = await res.json();
console.log("GET latest reading ->", reading);
console.log("reading.temperatureValue, reading.unit ->", reading.temperatureValue, reading.unit);

const post = await fetch(`${BASE}/stations/st-01/readings`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ temperatureValue: 16.4, unit: "celsius" }),
});
console.log(`POST new reading -> ${post.status}`, await post.json());
