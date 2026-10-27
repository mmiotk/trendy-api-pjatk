// Klient bez biblioteki: zwykły POST z `query` i `variables`.
const query = `
  query Game($id: ID!) {
    game(id: $id) { title year publisher { name } }
  }
`;

const response = await fetch("http://localhost:4040/graphql", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ query, variables: { id: "3" } }),
});

// Status 200 nie znaczy sukcesu: o błędach decyduje pole `errors` w treści.
const body = await response.json();
console.log(response.status, JSON.stringify(body.data));
