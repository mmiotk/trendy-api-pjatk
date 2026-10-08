#!/usr/bin/env node
// Simulates the CI job that runs on every pull request touching contracts/.
// Four independent checks; the script exits 1 if ANY of them fails, exactly
// like a real CI job would. Segment 7 runs this TWICE with different
// environment variables: once on a compatible pair (exit 0) and once on the
// breaking pair (exit 1) — see contracts/openapi/weather.v1*.yaml.
import { spawnSync } from "node:child_process";

const OASDIFF_BASE = process.env.OASDIFF_BASE ?? "contracts/openapi/weather.v1.1.yaml";
const OASDIFF_NEXT = process.env.OASDIFF_NEXT ?? "contracts/openapi/weather.v2.yaml";
const BUF_BASE = process.env.BUF_BASE ?? "v1.1";
const BUF_NEXT = process.env.BUF_NEXT ?? "v2";

const results = [];

function run(label, command, args, options = {}, noise = null) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  const ok = result.status === 0;
  results.push({ label, ok, status: result.status });
  console.log(`\n--- ${label} ---`);
  console.log(`$ ${command} ${args.join(" ")}`);
  process.stdout.write(result.stdout ?? "");
  // `noise` is an optional regex: stderr lines matching it are dropped, all
  // other stderr lines (real errors) are still printed.
  const stderr = (result.stderr ?? "")
    .split("\n")
    .filter((line) => !(noise && noise.test(line)))
    .join("\n");
  process.stderr.write(stderr);
  console.log(ok ? `[PASS] ${label}` : `[FAIL] ${label} (exit ${result.status})`);
}

// 1. OpenAPI breaking-change diff (oasdiff). The npm package `openapi-diff`
// (OpenAPITools) does not support OpenAPI 3.1 (verified: "Unsupported
// OpenAPI version: 3.1.0"). The `oasdiff` command comes from the devDependency
// `@oasdiff-js/oasdiff-js`, which installs the official oasdiff binary for this
// platform, so a single `npm install` is enough, same as in lab 02.
run("oasdiff breaking (OpenAPI)", "npx", [
  "oasdiff",
  "breaking",
  "--fail-on",
  "ERR",
  OASDIFF_BASE,
  OASDIFF_NEXT,
]);

// 2. Protocol Buffers breaking-change check (buf breaking).
run(
  "buf breaking (Protocol Buffers)",
  "npx",
  ["buf", "breaking", BUF_NEXT, "--against", BUF_BASE],
  { cwd: "contracts/proto-evolution" },
);

// 3. AsyncAPI document validity. AsyncAPI CLI 6.2.0 prints four harmless
// WARNING lines from the `config` package to stderr (NODE_ENV / no config
// directory). Only those lines are filtered out; validation errors stay visible.
const ASYNCAPI_NOISE =
  /^WARNING: (NODE_ENV value|See https:\/\/github\.com\/node-config|No configurations found|To disable this warning)/;
run(
  "asyncapi validate",
  "npx",
  ["asyncapi", "validate", "contracts/asyncapi/weather-events.yaml"],
  {},
  ASYNCAPI_NOISE,
);

// 4. GraphQL SDL validity (buildSchema — parse + type-check the schema).
run("graphql buildSchema (SDL)", "node", ["scripts/validate-graphql-sdl.mjs"]);

console.log("\n=== contracts:check summary ===");
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label}`);
}

const allOk = results.every((r) => r.ok);
console.log(allOk ? "\nAll contract checks passed." : "\nAt least one contract check failed.");
process.exit(allOk ? 0 : 1);
