// Offset vs cursor pagination, both facing the same event: a screening gets
// added to the list while a client is in the middle of paging through it.
// Run the server first, then: npm run pagination-demo
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

async function getJson(url: string) {
  const res = await fetch(url);
  return res.json();
}

async function insertScreening(startTime: string) {
  const res = await fetch(`${BASE}/screenings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ movieId: 3, roomId: 2, startTime, priceCents: 2000, seatsTotal: 80 }),
  });
  return res.json();
}

function ids(page: { data: { id: number; startTime: string }[] }) {
  return page.data.map((s) => `${s.id}@${s.startTime.slice(11, 16)}`);
}

console.log("--- offset pagination ---");
const offsetPage1 = await getJson(`${BASE}/screenings?limit=5&offset=0`);
console.log("page 1 (offset=0):", ids(offsetPage1));

const inserted1 = await insertScreening("2026-09-25T16:00:00");
console.log(`\n>> cinema adds an extra afternoon screening: id=${inserted1.id} at ${inserted1.startTime}\n`);

const offsetPage2 = await getJson(`${BASE}/screenings?limit=5&offset=5`);
console.log("page 2 (offset=5):", ids(offsetPage2));

const overlap = ids(offsetPage1).filter((x) => ids(offsetPage2).includes(x));
console.log(overlap.length > 0 ? `>> DUPLICATE across pages: ${overlap.join(", ")}` : ">> no duplicate");

console.log("\n--- cursor pagination ---");
const cursorPage1 = await getJson(`${BASE}/screenings?limit=5&cursor=true`);
console.log("page 1 (cursor=true):", ids(cursorPage1), " next=", cursorPage1.next);

const inserted2 = await insertScreening("2026-09-25T16:15:00");
console.log(`\n>> cinema adds another screening: id=${inserted2.id} at ${inserted2.startTime} (same slot as before)\n`);

const cursorPage2 = await getJson(`${BASE}/screenings?limit=5&after=${cursorPage1.next}`);
console.log("page 2 (after=<cursor>):", ids(cursorPage2));

const cursorOverlap = ids(cursorPage1).filter((x) => ids(cursorPage2).includes(x));
console.log(cursorOverlap.length > 0 ? `>> DUPLICATE across pages: ${cursorOverlap.join(", ")}` : ">> no duplicate, no skip");
