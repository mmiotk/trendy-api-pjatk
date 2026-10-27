import { ApolloClient, HttpLink, InMemoryCache, gql } from "@apollo/client";

// Własny fetch liczy żądania, które naprawdę wychodzą do serwera.
let requests = 0;
const countingFetch: typeof fetch = (input, init) => {
  requests += 1;
  return fetch(input, init);
};

const cache = new InMemoryCache();
const client = new ApolloClient({
  link: new HttpLink({ uri: "http://localhost:4040/graphql", fetch: countingFetch }),
  cache,
});

// Kształt odpowiedzi dla TypeScripta; sam klient go nie sprawdza.
type GamesData = { games: { id: string; title: string; copies: { id: string; available: boolean }[] }[] };

const GAMES = gql`
  query Games {
    games(limit: 3) { id title copies { id available } }
  }
`;

// --- 12.1: drugie zapytanie z pamięci ---
await client.query({ query: GAMES });
console.log("after 1st query, requests:", requests); // → 1
await client.query({ query: GAMES });
console.log("after 2nd query, requests:", requests); // → 1
await client.query({ query: GAMES, fetchPolicy: "network-only" });
console.log("after network-only, requests:", requests); // → 2

// Pamięć trzyma obiekty pod kluczem `__typename:id`, a nie całe odpowiedzi.
console.log(Object.keys(cache.extract()));

// --- 12.2: mutacja aktualizuje obiekt po `id` ---
type BorrowData = { borrowCopy: { __typename: string; loan?: { id: string; borrower: string } } };

const BORROW = gql`
  mutation Borrow($input: BorrowCopyInput!) {
    borrowCopy(input: $input) {
      __typename
      ... on BorrowCopySuccess {
        loan { id borrower }
        copy { id available }
      }
    }
  }
`;

const before = await client.query<GamesData>({ query: GAMES });
console.log("Pandemic copies before:", JSON.stringify(before.data?.games[1].copies));

await client.mutate<BorrowData>({ mutation: BORROW, variables: { input: { gameId: "2", borrower: "eve" } } });

// Odpowiedź mutacji zawierała `Copy` z `id: "3"`, więc pamięć zmieniła obiekt `Copy:3`.
const after = await client.query<GamesData>({ query: GAMES });
console.log("Pandemic copies after:", JSON.stringify(after.data?.games[1].copies));
console.log("requests:", requests); // → 3

// --- 12.3: lista, której pamięć nie uzupełni sama (`cache.modify`) ---
const LOANS = gql`
  query Loans {
    loans { id borrower }
  }
`;
await client.query({ query: LOANS });
console.log("loans before:", JSON.stringify(cache.extract().ROOT_QUERY?.loans));

// Nowe wypożyczenie nie wchodzi samo na listę `loans`, bo to inne pole niż `copy`.
// Funkcja `update` dostaje pamięć i wynik mutacji i dopisuje referencję do listy.
await client.mutate<BorrowData>({
  mutation: BORROW,
  variables: { input: { gameId: "3", borrower: "frank" } },
  update(cache, { data }) {
    if (data?.borrowCopy.__typename !== "BorrowCopySuccess") return;
    cache.modify({
      fields: {
        loans(existing = []) {
          const ref = cache.writeFragment({
            data: data.borrowCopy.loan,
            fragment: gql`
              fragment NewLoan on Loan { id borrower }
            `,
          });
          return [...existing, ref];
        },
      },
    });
  },
});
const loans = await client.query({ query: LOANS });
console.log("loans after:", JSON.stringify(loans.data));
console.log("requests:", requests); // → 5

// --- 12.4: zapis ręczny i czyszczenie ---
await client.clearStore();
console.log("keys after clearStore:", Object.keys(cache.extract()).length); // → 0

// `writeQuery` wpisuje dane do pamięci tak, jakby przyszły z serwera.
client.writeQuery({
  query: LOANS,
  data: { loans: [{ __typename: "Loan", id: "100", borrower: "written by hand" }] },
});
const written = await client.query({ query: LOANS });
console.log("from cache:", JSON.stringify(written.data), "requests:", requests); // → requests: 5

// `resetStore` też czyści pamięć (np. po wylogowaniu), a dodatkowo ponawia aktywne zapytania.
// Tu żadne zapytanie nie jest aktywne, więc nic nie zostaje pobrane ponownie.
console.log("resetStore refetched:", await client.resetStore()); // → []
console.log("requests:", requests); // → 5
