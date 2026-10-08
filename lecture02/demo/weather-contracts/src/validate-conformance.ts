// The "third way" (spec + code verified together): instead of picking
// code-first OR design-first, we keep design-first (contracts/openapi/) as
// the source of truth AND compile its schemas with ajv, then fire real HTTP
// requests at the running server and check the ACTUAL response bytes
// against the SAME schema express-openapi-validator already enforces
// server-side. Two independent checks agreeing is the point.
// Run the server first (npm run dev), then: npm run conformance
// BASE_URL defaults to /v1 (segment 6 moved v1 behind a path prefix) — the
// check still targets the ORIGINAL v1 schema on purpose: v1.1 only ADDED an
// optional field, so a v1.1 response staying valid against v1 is itself a
// live backward-compatibility check, not just a leftover from segment 3.
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { Ajv } from "ajv";

const BASE = process.env.BASE_URL ?? "http://localhost:3000/v1";
const contract = load(readFileSync("./contracts/openapi/weather.v1.yaml", "utf8")) as any;

// strict:false — the OpenAPI document carries keywords ajv does not know
// (info, paths, operationId, ...); we only ever $ref into components/schemas.
const ajv = new Ajv({ strict: false });
ajv.addSchema(contract, "weather-v1");

function schemaFor(name: string) {
  return ajv.compile({ $ref: `weather-v1#/components/schemas/${name}` });
}

const validateStation = schemaFor("Station");
const validateReading = schemaFor("Reading");

async function check(label: string, url: string, validate: ReturnType<typeof schemaFor>) {
  const res = await fetch(url);
  const body = await res.json();
  const ok = validate(body);
  console.log(`${ok ? "OK  " : "FAIL"} ${label}`);
  if (!ok) {
    console.log("     ", validate.errors);
  }
  return ok;
}

let allOk = true;
allOk = (await check("GET /stations/st-01 vs Station schema", `${BASE}/stations/st-01`, validateStation)) && allOk;
allOk =
  (await check(
    "GET /stations/st-01/readings/latest vs Reading schema",
    `${BASE}/stations/st-01/readings/latest`,
    validateReading,
  )) && allOk;

console.log(allOk ? "\nconformance: PASS (server output matches contracts/openapi/weather.v1.yaml)" : "\nconformance: FAIL");
process.exit(allOk ? 0 : 1);
