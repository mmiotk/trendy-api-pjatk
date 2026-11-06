import { GraphQLError, Kind, getDirectiveValues, getNamedType, isObjectType } from "graphql";
import type { ASTVisitor, FieldNode, GraphQLField, GraphQLObjectType, SelectionSetNode, ValidationContext } from "graphql";

// Głębokość: najdłuższa ścieżka pól w dół. Fragmentów reguła nie rozwija.
function depthOf(set: SelectionSetNode | undefined): number {
  let max = 0;
  for (const selection of set?.selections ?? []) {
    if (selection.kind === Kind.FIELD) max = Math.max(max, 1 + depthOf(selection.selectionSet));
  }
  return max;
}

// Reguła walidacji to funkcja, która dostaje kontekst walidacji i zwraca odwiedzającego drzewo dokumentu.
export function depthRule(max: number) {
  return (context: ValidationContext): ASTVisitor => ({
    OperationDefinition(operation) {
      const depth = depthOf(operation.selectionSet);
      if (depth > max) {
        context.reportError(new GraphQLError(`Query depth ${depth} exceeds the limit of ${max}`, { nodes: operation }));
      }
    },
  });
}

// Liczy pola z aliasem w dokumencie i zgłasza błąd raz, przy pierwszym aliasie ponad limit.
export function aliasRule(max: number) {
  return (context: ValidationContext): ASTVisitor => {
    let count = 0;
    return {
      Field(node) {
        if (!node.alias) return;
        count += 1;
        if (count === max + 1) {
          context.reportError(new GraphQLError(`More than ${max} aliases in one document`, { nodes: node }));
        }
      },
    };
  };
}

// Rozmiar strony listy `auctions`: bez argumentu 10, najmniej 0, najwięcej 100.
export function pageSize(limit?: number): number {
  return Math.min(Math.max(limit ?? 10, 0), 100);
}

// Waga pola: `@cost(weight: …)` ze schematu albo 1.
function weightOf(context: ValidationContext, field: GraphQLField<unknown, unknown>): number {
  const cost = getDirectiveValues(context.getSchema().getDirective("cost")!, field.astNode!);
  return cost ? (cost.weight as number) : 1;
}

// Mnożnik: lista z argumentem `limit` powtarza koszt swoich pól tyle razy, ile elementów zwróci.
function multiplierOf(field: GraphQLField<unknown, unknown>, node: FieldNode): number {
  if (!field.args.some((arg) => arg.name === "limit")) return 1;
  const limit = node.arguments?.find((arg) => arg.name.value === "limit")?.value;
  if (!limit) return pageSize();
  // Wartości zmiennej walidacja nie zna, więc liczy się największa strona.
  return limit.kind === Kind.INT ? pageSize(Number(limit.value)) : 100;
}

// Koszt: suma wag pól skalarnych; pole-obiekt to mnożnik razy koszt jego pól. Fragmentów reguła nie rozwija.
function costOf(context: ValidationContext, set: SelectionSetNode, parent: GraphQLObjectType): number {
  let total = 0;
  for (const selection of set.selections) {
    if (selection.kind !== Kind.FIELD) continue;
    // `__typename` i pola introspekcji nie leżą w typie, więc nic nie kosztują.
    const field = parent.getFields()[selection.name.value];
    if (!field) continue;
    const type = getNamedType(field.type);
    if (selection.selectionSet && isObjectType(type)) {
      total += multiplierOf(field, selection) * costOf(context, selection.selectionSet, type);
    } else {
      total += weightOf(context, field);
    }
  }
  return total;
}

export function costRule(max: number) {
  return (context: ValidationContext): ASTVisitor => ({
    OperationDefinition(operation) {
      const root = context.getSchema().getRootType(operation.operation);
      if (!root) return;
      const cost = costOf(context, operation.selectionSet, root);
      if (cost > max) {
        context.reportError(new GraphQLError(`Query cost ${cost} exceeds the limit of ${max}`, { nodes: operation }));
      }
    },
  });
}
