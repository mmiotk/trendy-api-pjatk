// Same operation ("reserve a seat"), two contracts: resource-oriented PATCH
// vs intent-oriented POST /reservations. Run the server first, then:
// npm run reserve-demo
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

async function getScreening(id: number) {
  const res = await fetch(`${BASE}/screenings/${id}`);
  return res.json();
}

// Resource-oriented client: read the current count, compute the new count,
// PATCH it back. Two clients racing on the same screening can both read the
// same starting value and both "win" — one reservation silently disappears.
async function reserveOneSeatResourceStyle(screeningId: number) {
  const screening = await getScreening(screeningId);
  const nextValue = screening.seatsReserved + 1;
  const res = await fetch(`${BASE}/screenings/${screeningId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seatsReserved: nextValue }),
  });
  return { status: res.status, body: await res.json(), readValue: screening.seatsReserved, wroteValue: nextValue };
}

// Intent-oriented client: state the goal, let the server own the invariant.
async function reserveOneSeatIntentStyle(screeningId: number, customerName: string) {
  const res = await fetch(`${BASE}/screenings/${screeningId}/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seatCount: 1, customerName }),
  });
  return { status: res.status, body: await res.json() };
}

console.log("--- 1) resource-oriented PATCH: two clients race on screening 2 ---");
const before = await getScreening(2);
console.log(`before: seatsReserved=${before.seatsReserved} / seatsTotal=${before.seatsTotal}`);

const [clientA, clientB] = await Promise.all([
  reserveOneSeatResourceStyle(2),
  reserveOneSeatResourceStyle(2),
]);
console.log("client A:", clientA);
console.log("client B:", clientB);

const after = await getScreening(2);
console.log(`after:  seatsReserved=${after.seatsReserved} (expected +2, actual +${after.seatsReserved - before.seatsReserved})`);

console.log("\n--- 2) intent-oriented POST: three clients race for the last seat on screening 2 ---");
const [r1, r2, r3] = await Promise.all([
  reserveOneSeatIntentStyle(2, "Anna"),
  reserveOneSeatIntentStyle(2, "Bartek"),
  reserveOneSeatIntentStyle(2, "Celina"),
]);
console.log("Anna:  ", r1);
console.log("Bartek:", r2);
console.log("Celina:", r3);

const final = await getScreening(2);
console.log(`final: seatsReserved=${final.seatsReserved} / seatsTotal=${final.seatsTotal} (no oversell)`);
