// Runs all four old/new client x server combinations in one command — the
// same steps segment 5 walks through by hand with client-v1.ts/client-v2.ts,
// gathered here so `npm run evolution` reproduces the numbers in POMIARY.md.
// Requires the server already running: npm run dev (port 3000, serves v1.1
// at /v1 and v2 at /v2 — see segment 6). Override the addresses with
// V1_BASE_URL and V2_BASE_URL, like the other scripts do with BASE_URL.
const V1_1 = process.env.V1_BASE_URL ?? "http://localhost:3000/v1";
const V2 = process.env.V2_BASE_URL ?? "http://localhost:3000/v2";

async function getLatest(base: string) {
  const res = await fetch(`${base}/stations/st-01/readings/latest`);
  return res.json();
}

async function postReading(base: string, body: unknown) {
  const res = await fetch(`${base}/stations/st-01/readings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

console.log("=== 1) old client (temperatureCelsius) vs v1.1 server — compatible ===");
const r1 = await getLatest(V1_1);
console.log("GET:", r1, "-> temperatureCelsius:", r1.temperatureCelsius);

console.log("\n=== 2) old client (temperatureCelsius) vs v2 server — BREAKS silently on read ===");
const r2 = await getLatest(V2);
console.log("GET:", r2, "-> temperatureCelsius:", r2.temperatureCelsius, "(undefined: field renamed)");

console.log("\n=== 3) new client (temperatureValue+unit) vs v2 server — compatible ===");
const r3 = await postReading(V2, { temperatureValue: 12.1, unit: "celsius" });
console.log("POST:", r3.status, r3.body);

console.log("\n=== 4) new client (temperatureValue+unit) vs v1.1 server — BREAKS loudly on write ===");
const r4 = await postReading(V1_1, { temperatureValue: 12.1, unit: "celsius" });
console.log("POST:", r4.status, r4.body);
