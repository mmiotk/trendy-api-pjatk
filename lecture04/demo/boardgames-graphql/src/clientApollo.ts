import { ApolloClient, HttpLink, InMemoryCache, gql } from "@apollo/client";

// Ten sam klient co w przeglądarce, tylko bez Reacta: HttpLink wysyła żądania, InMemoryCache je pamięta.
const client = new ApolloClient({
  link: new HttpLink({ uri: "http://localhost:4040/graphql" }),
  cache: new InMemoryCache(),
});

// Fragment opisuje dane, których potrzebuje jeden fragment interfejsu (tu: karta gry).
const GAME_CARD = gql`
  fragment GameCard on Game {
    id
    title
    year
    publisher { id name }
  }
`;

const GAME = gql`
  query Game($id: ID!) {
    game(id: $id) { ...GameCard }
  }
  ${GAME_CARD}
`;

const { data } = await client.query({ query: GAME, variables: { id: "3" } });
console.log(JSON.stringify(data));

// Inaczej niż w `fetch`, błąd GraphQL (`errors` w odpowiedzi) kończy się tu wyjątkiem.
try {
  await client.query({ query: gql`{ games { price } }` });
} catch (error) {
  console.log((error as Error).name, "|", (error as Error).message);
}
