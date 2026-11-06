import { GraphQLError, defaultFieldResolver } from "graphql";
import type { GraphQLSchema } from "graphql";
import { MapperKind, getDirective, mapSchema } from "@graphql-tools/utils";
import type { Context } from "./context.ts";

// W SDL `@auth` jest tylko oznaczeniem. Ta funkcja zamienia je na kontrolę w resolverze każdego oznaczonego pola.
export function applyAuth(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      // `getDirective` zwraca listę użyć dyrektywy na tym polu albo undefined.
      if (!getDirective(schema, fieldConfig, "auth")?.[0]) return fieldConfig;
      const resolve = fieldConfig.resolve ?? defaultFieldResolver;
      return {
        ...fieldConfig,
        resolve: (source, args, ctx: Context, info) => {
          if (!ctx.me) {
            throw new GraphQLError("You must be logged in", { extensions: { code: "UNAUTHENTICATED" } });
          }
          return resolve(source, args, ctx, info);
        },
      };
    },
  });
}

// Ile żądań użyło każdego przestarzałego pola i które żądania już policzono.
const usage = new Map<string, number>();
const counted = new WeakMap<object, Set<string>>();

// Każde pole z `@deprecated` liczy użycia, żeby było wiadomo, kiedy można je usunąć.
export function trackDeprecated(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName, typeName) => {
      if (!fieldConfig.deprecationReason) return fieldConfig;
      const resolve = fieldConfig.resolve ?? defaultFieldResolver;
      const key = `${typeName}.${fieldName}`;
      return {
        ...fieldConfig,
        resolve: (source, args, ctx: Context, info) => {
          // Pole zwrócone dla wielu obiektów liczy się raz na żądanie (kontekst jest nowy w każdym żądaniu).
          const seen = counted.get(ctx) ?? new Set<string>();
          counted.set(ctx, seen);
          if (!seen.has(key)) {
            seen.add(key);
            usage.set(key, (usage.get(key) ?? 0) + 1);
            console.log(`Deprecated field used: ${key}, requests so far: ${usage.get(key)}`);
          }
          return resolve(source, args, ctx, info);
        },
      };
    },
  });
}
