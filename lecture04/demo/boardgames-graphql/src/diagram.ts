import { getIntrospectionQuery, graphql } from "graphql";
import { schema } from "./schema.ts";

// Odpowiedź introspekcji w wersji skróconej do tego, czego używamy.
interface TypeRef {
  kind: string;
  name: string | null;
  ofType: TypeRef | null;
}
interface IntrospectedType {
  kind: string;
  name: string;
  fields: { name: string; type: TypeRef }[] | null;
  possibleTypes: { name: string }[] | null;
}

const result = await graphql({ schema, source: getIntrospectionQuery() });
const types = (result.data as any).__schema.types as IntrospectedType[];

// Zdejmuje opakowania NON_NULL i LIST, aż zostanie typ nazwany.
function namedType(ref: TypeRef): string {
  return ref.name ?? namedType(ref.ofType!);
}

// W grafie zostają tylko typy obiektowe i unie; skalary (`ID`, `String`) tylko zaśmiecają rysunek.
const nodes = types.filter((t) => ["OBJECT", "UNION"].includes(t.kind) && !t.name.startsWith("__"));
const nodeNames = new Set(nodes.map((t) => t.name));

// Krawędzie grafu: pole obiektu prowadzi do typu, a unia do swoich członków.
const edges: { from: string; label: string; to: string; dashed: boolean }[] = [];
for (const type of nodes) {
  for (const field of type.fields ?? []) {
    const to = namedType(field.type);
    if (nodeNames.has(to)) edges.push({ from: type.name, label: field.name, to, dashed: false });
  }
  for (const member of type.possibleTypes ?? []) {
    if (type.kind === "UNION") edges.push({ from: type.name, label: "", to: member.name, dashed: true });
  }
}

// Typy z `Query` i `Mutation` w dół to typy osiągalne; reszta jest osierocona.
const reachable = new Set(["Query", "Mutation"]);
for (let changed = true; changed; ) {
  changed = false;
  for (const edge of edges) {
    if (reachable.has(edge.from) && !reachable.has(edge.to)) {
      reachable.add(edge.to);
      changed = true;
    }
  }
}

const orphans = nodes.filter((t) => !reachable.has(t.name)).map((t) => t.name);

// Wynik to tekst Mermaid; węzły osierocone dostają klasę `orphan`, bo nie mają krawędzi.
console.log("flowchart LR");
for (const edge of edges) {
  const arrow = edge.dashed ? "-.->" : edge.label ? `-->|${edge.label}|` : "-->";
  console.log(`  ${edge.from} ${arrow} ${edge.to}`);
}
for (const name of orphans) console.log(`  ${name}:::orphan`);
console.log("  classDef orphan fill:#fee,stroke:#c00");
