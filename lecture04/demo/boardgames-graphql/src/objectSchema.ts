import {
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  printSchema,
} from "graphql";

// Ten sam fragment schematu co w pliku SDL, ale zbudowany z obiektów.
const PublisherType = new GraphQLObjectType({
  name: "Publisher",
  fields: {
    name: { type: new GraphQLNonNull(GraphQLString) },
    country: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const GameType = new GraphQLObjectType({
  name: "Game",
  fields: {
    title: { type: new GraphQLNonNull(GraphQLString) },
    year: { type: new GraphQLNonNull(GraphQLInt) },
    publisher: { type: new GraphQLNonNull(PublisherType) },
  },
});

const QueryType = new GraphQLObjectType({
  name: "Query",
  fields: {
    // `[Game!]!` to NonNull(List(NonNull(Game))): każdy nawias to osobny obiekt.
    games: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GameType))) },
  },
});

export const objectSchema = new GraphQLSchema({ query: QueryType });

// `printSchema` zamienia obiekt schematu z powrotem na tekst SDL.
console.log(printSchema(objectSchema));
