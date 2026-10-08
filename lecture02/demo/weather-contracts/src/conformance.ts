import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { Ajv } from "ajv";

const BASE = process.env.BASE_URL ?? "http://localhost:3000/v1";

// Compile the Reading schema straight from the contract.
const contract = load(readFileSync("contracts/openapi/weather.v1.yaml", "utf8")) as object;
const ajv = new Ajv({ strict: false });
ajv.addSchema(contract, "weather");
const validate = ajv.compile({ $ref: "weather#/components/schemas/Reading" });

// Check a real server response against it; the exit code is for CI.
const res = await fetch(`${BASE}/stations/st-01/readings/latest`);
const ok = validate(await res.json());
console.log(ok ? "conformance: PASS" : "conformance: FAIL");
if (!ok) console.log(validate.errors);
process.exit(ok ? 0 : 1);
