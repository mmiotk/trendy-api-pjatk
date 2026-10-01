// Synchronous (blocking) sales report vs 202 Accepted + polling.
// Run the server first, then: npm run report-demo
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const DATE = process.env.DATE ?? "2026-09-25";

function since(start: number) {
  return `${(performance.now() - start).toFixed(0)}ms`;
}

console.log("--- 1) blocking GET, client gives up after 2000ms ---");
{
  const start = performance.now();
  try {
    await fetch(`${BASE}/reports/sales-sync?date=${DATE}`, { signal: AbortSignal.timeout(2000) });
    console.log("unexpected success at", since(start));
  } catch (err) {
    console.log(`client aborted after ${since(start)}:`, (err as Error).name, (err as Error).message);
  }
}

console.log("\n--- 2) blocking GET, client waits it out ---");
{
  const start = performance.now();
  const res = await fetch(`${BASE}/reports/sales-sync?date=${DATE}`);
  const body = await res.json();
  console.log(`response after ${since(start)}:`, body);
}

console.log("\n--- 3) 202 Accepted + polling ---");
{
  const start = performance.now();
  const created = await fetch(`${BASE}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date: DATE }),
  });
  const location = created.headers.get("Location");
  const acceptedBody = await created.json();
  console.log(`202 Accepted after ${since(start)} — Location: ${location}`, acceptedBody);

  let polls = 0;
  let report = acceptedBody;
  while (report.status !== "done") {
    await new Promise((resolve) => setTimeout(resolve, 500));
    polls += 1;
    const res = await fetch(`${BASE}${location}`);
    report = await res.json();
    console.log(`  poll #${polls} at ${since(start)}: status=${report.status}`);
  }
  console.log(`done after ${since(start)} and ${polls} polling requests:`, report);
}
