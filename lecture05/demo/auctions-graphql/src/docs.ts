import { mkdirSync, writeFileSync } from "node:fs";
import { isEnumType, isObjectType } from "graphql";
import { schema } from "./schema.ts";

// Dokumentacja statyczna powstaje ze schematu, bez serwera i bez introspekcji przez HTTP.
const html: string[] = ["<h1>Auctions API</h1>"];

for (const type of Object.values(schema.getTypeMap())) {
  if (type.name.startsWith("__")) continue;
  if (isObjectType(type)) {
    html.push(`<h2>${type.name}</h2>`, `<p>${type.description ?? ""}</p>`, "<ul>");
    for (const field of Object.values(type.getFields())) {
      const args = field.args.map((arg) => `${arg.name}: ${arg.type}`).join(", ");
      html.push(`<li><code>${field.name}${args ? `(${args})` : ""}: ${field.type}</code> ${field.description ?? ""}</li>`);
    }
    html.push("</ul>");
  } else if (isEnumType(type)) {
    html.push(`<h2>${type.name}</h2>`, `<p>${type.getValues().map((value) => value.name).join(", ")}</p>`);
  }
}

mkdirSync("docs", { recursive: true });
writeFileSync("docs/schema.html", html.join("\n") + "\n");
console.log(`docs/schema.html: ${html.length} lines`);
