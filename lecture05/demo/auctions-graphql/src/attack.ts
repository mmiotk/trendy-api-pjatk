const url = `http://localhost:${process.env.PORT ?? 4050}/graphql`;

async function send(label: string, query: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body: any = await response.json();
  const messages = body.errors?.map((error: { message: string }) => error.message).join("; ") ?? "ok";
  console.log(label, "|", response.status, "| sql:", response.headers.get("x-sql-statements"), "|", messages);
}

// Zapytanie cykliczne: auction -> seller -> auctions -> seller -> ... -> id. `depth` liczy też liść `id`.
function nested(depth: number): string {
  const cycle = ["seller", "auctions"];
  const path = ['auction(id: "1")'];
  while (path.length < depth - 1) path.push(cycle[(path.length - 1) % 2]);
  return `{ ${path.join(" { ")} { id ${"}".repeat(path.length)} }`;
}

// Atak wsadowy: jedno żądanie HTTP, `count` aliasów tego samego pola.
function aliases(count: number): string {
  const fields = Array.from({ length: count }, (_, i) => `a${i}: auction(id: "1") { id }`);
  return `{ ${fields.join(" ")} }`;
}

await send("depth 6  ", nested(6));
await send("depth 7  ", nested(7));
await send("depth 50 ", nested(50));
await send("aliases 15 ", aliases(15));
await send("aliases 16 ", aliases(16));
await send("aliases 300", aliases(300));
