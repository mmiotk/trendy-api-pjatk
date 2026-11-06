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
