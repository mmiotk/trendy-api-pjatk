import { GraphQLError, Kind, getDirectiveValues, getNamedType, isCompositeType } from "graphql";
import type {
  ASTVisitor,
  FieldNode,
  FragmentDefinitionNode,
  GraphQLCompositeType,
  GraphQLField,
  GraphQLSchema,
  SelectionSetNode,
  ValidationContext,
} from "graphql";

export const MAX_DEPTH = 6;
export const MAX_ALIASES = 15;
export const MAX_COST = 100;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

// Rozmiar strony, który obowiązuje w resolverze i w liczeniu kosztu.
export function pageSize(limit?: number): number {
  return Math.min(Math.max(limit ?? DEFAULT_LIMIT, 0), MAX_LIMIT);
}

type Fragments = Record<string, FragmentDefinitionNode>;

// Fragmenty nazwane z dokumentu, po nazwie, żeby rozwijać je w miejscu użycia.
function fragmentsOf(context: ValidationContext): Fragments {
  const fragments: Fragments = {};
  for (const definition of context.getDocument().definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) fragments[definition.name.value] = definition;
  }
  return fragments;
}

// Głębokość zbioru pól: najdłuższa ścieżka od tego zbioru w dół. Fragmenty są rozwijane w miejscu użycia.
function depthOf(set: SelectionSetNode, fragments: Fragments, seen: string[]): number {
  let max = 0;
  for (const selection of set.selections) {
    if (selection.kind === Kind.FIELD) {
      // Introspekcja ma własną, głęboką strukturę i nie liczy się do limitu.
      if (selection.name.value.startsWith("__")) continue;
      const inner = selection.selectionSet ? depthOf(selection.selectionSet, fragments, seen) : 0;
      max = Math.max(max, 1 + inner);
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      max = Math.max(max, depthOf(selection.selectionSet, fragments, seen));
    } else {
      const name = selection.name.value;
      // Fragment już rozwijany na tej ścieżce to cykl; reguła o cyklach zgłosi go osobno.
      if (seen.includes(name) || !fragments[name]) continue;
      max = Math.max(max, depthOf(fragments[name].selectionSet, fragments, [...seen, name]));
    }
  }
  return max;
}

// Reguła walidacji to funkcja, która dostaje kontekst walidacji i zwraca odwiedzającego drzewo zapytania.
export function depthRule(max: number) {
  return (context: ValidationContext): ASTVisitor => {
    const fragments = fragmentsOf(context);
    return {
      OperationDefinition(operation) {
        const depth = depthOf(operation.selectionSet, fragments, []);
        if (depth > max) {
          context.reportError(new GraphQLError(`Query depth ${depth} exceeds the limit of ${max}`, { nodes: operation }));
        }
      },
    };
  };
}

// Liczy pola z aliasem w całym dokumencie (także we fragmentach) i zgłasza błąd raz, przy pierwszym ponad limit.
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

// Waga pola z `@cost(weight: …)`; pole bez dyrektywy waży 1.
function weightOf(schema: GraphQLSchema, field: GraphQLField<unknown, unknown>): number {
  const values = getDirectiveValues(schema.getDirective("cost")!, field.astNode!);
  return values ? (values.weight as number) : 1;
}

// Mnożnik listy: wartość argumentu `limit`. Zmiennej nie widać w walidacji, więc liczy się największa strona.
function multiplierOf(field: GraphQLField<unknown, unknown>, node: FieldNode): number {
  if (!field.args.some((arg) => arg.name === "limit")) return 1;
  const argument = node.arguments?.find((arg) => arg.name.value === "limit");
  if (!argument) return pageSize();
  return argument.value.kind === Kind.INT ? pageSize(Number(argument.value.value)) : MAX_LIMIT;
}

// Koszt = suma wag pól skalarnych; lista z `limit` mnoży koszt swoich pól.
function costOf(schema: GraphQLSchema, set: SelectionSetNode, parent: GraphQLCompositeType, fragments: Fragments, seen: string[]): number {
  let total = 0;
  for (const selection of set.selections) {
    if (selection.kind === Kind.FIELD) {
      if (selection.name.value.startsWith("__") || !("getFields" in parent)) continue;
      const field = parent.getFields()[selection.name.value];
      if (!field) continue;
      const type = getNamedType(field.type);
      if (selection.selectionSet && isCompositeType(type)) {
        total += multiplierOf(field, selection) * costOf(schema, selection.selectionSet, type, fragments, seen);
      } else {
        total += weightOf(schema, field);
      }
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      const condition = selection.typeCondition ? schema.getType(selection.typeCondition.name.value) : parent;
      if (isCompositeType(condition)) total += costOf(schema, selection.selectionSet, condition, fragments, seen);
    } else {
      const name = selection.name.value;
      const fragment = fragments[name];
      if (seen.includes(name) || !fragment) continue;
      const condition = schema.getType(fragment.typeCondition.name.value);
      if (isCompositeType(condition)) total += costOf(schema, fragment.selectionSet, condition, fragments, [...seen, name]);
    }
  }
  return total;
}

export function costRule(max: number) {
  return (context: ValidationContext): ASTVisitor => {
    const schema = context.getSchema();
    const fragments = fragmentsOf(context);
    return {
      OperationDefinition(operation) {
        const root = schema.getRootType(operation.operation);
        if (!root) return;
        const cost = costOf(schema, operation.selectionSet, root, fragments, []);
        if (cost > max) {
          context.reportError(new GraphQLError(`Query cost ${cost} exceeds the limit of ${max}`, { nodes: operation }));
        }
      },
    };
  };
}
