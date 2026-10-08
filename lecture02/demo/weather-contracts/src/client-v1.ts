// An "old" client, written against v1/v1.1: reads `temperatureCelsius`,
// posts a new reading with `temperatureCelsius`. Used in segment 5 against
// BOTH the v1.1 server (works) and the v2 server (breaks) on purpose.
// Before segment 6 this pointed at unprefixed http://localhost:3000 —
// segment 6 moves v1 behind /v1, so every caller updates its BASE_URL once.
const BASE = process.env.BASE_URL ?? "http://localhost:3000/v1";

const res = await fetch(`${BASE}/stations/st-01/readings/latest`);
const reading = await res.json();
console.log("GET latest reading ->", reading);
console.log("reading.temperatureCelsius.toFixed(1) ->", reading.temperatureCelsius.toFixed(1));

const post = await fetch(`${BASE}/stations/st-01/readings`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ temperatureCelsius: 16.4 }),
});
console.log(`POST new reading -> ${post.status}`, await post.json());
