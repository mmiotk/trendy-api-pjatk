// The SAME Reading record in three wire formats, with ONE schema evolution
// (the same "add optional qualityFlag" change from segment 5) applied to
// each — three different evolution mechanisms, one comparison table.
// Run: npm run formats (no server needed, everything is local encode/decode)
import { readFileSync } from "node:fs";
import protobuf from "protobufjs";
import avro from "avsc";

const baseReading = {
  id: "rd-1002",
  stationId: "st-01",
  observedAt: "2026-09-25T09:00:00Z",
  temperatureCelsius: 14.2,
};
const evolvedReading = { ...baseReading, qualityFlag: "ok" };

function report(label: string, bytes: number) {
  console.log(`${label.padEnd(45)} ${String(bytes).padStart(4)} bytes`);
}

console.log("=== 1) same record, three formats (no evolution yet) ===");
const jsonBytes = Buffer.byteLength(JSON.stringify(baseReading), "utf8");
report("JSON.stringify(baseReading)", jsonBytes);

const protoRoot = await protobuf.load("contracts/proto/weather/v1/weather.proto");
const ReadingV1 = protoRoot.lookupType("weather.v1.Reading");
const protoV1Bytes = ReadingV1.encode(ReadingV1.create(baseReading)).finish();
report("Protobuf (weather/v1/weather.proto)", protoV1Bytes.length);

const avroV1Type = avro.Type.forSchema({
  type: "record",
  name: "Reading",
  fields: [
    { name: "id", type: "string" },
    { name: "stationId", type: "string" },
    { name: "observedAt", type: "string" },
    { name: "temperatureCelsius", type: "double" },
  ],
});
const avroV1Bytes = avroV1Type.toBuffer(baseReading);
report("Avro (v1 schema)", avroV1Bytes.length);

// Why Avro is smaller: Protobuf writes a tag (field number + wire type) before
// every value, e.g. 0a = field 1, length-delimited. Avro writes values only, in
// schema order, so the reader must know the writer's schema.
console.log("Protobuf hex:", Buffer.from(protoV1Bytes).toString("hex"));
console.log("Avro hex:    ", avroV1Bytes.toString("hex"));

console.log("\n=== 2) one evolution: add OPTIONAL qualityFlag — three mechanisms ===");

// --- JSON Schema: qualityFlag is just another optional property. Both old
// and new records validate against the v1.1 schema (segment 3's ajv setup).
import { Ajv } from "ajv";
import { load } from "js-yaml";
const contract = load(readFileSync("./contracts/openapi/weather.v1.1.yaml", "utf8")) as any;
const ajv = new Ajv({ strict: false });
ajv.addSchema(contract, "weather-v1.1");
const validateReading = ajv.compile({ $ref: "weather-v1.1#/components/schemas/Reading" });
console.log(
  `JSON Schema: old record valid? ${validateReading({ ...baseReading, id: "x" })}` +
    ` | new record valid? ${validateReading({ ...evolvedReading, id: "x" })}`,
);
const jsonEvolvedBytes = Buffer.byteLength(JSON.stringify(evolvedReading), "utf8");
report("JSON.stringify(evolvedReading)", jsonEvolvedBytes);

// --- Protobuf: a NEW field number (5) is added. An OLD reader (weather/v1,
// field 4 only) decodes bytes written by the NEW writer and simply never
// sees field 5 — unknown fields are dropped, no error, no crash.
const protoEvolvedRoot = await protobuf.load("contracts/proto-evolution/v1.1/weather/v1/weather.proto");
const ReadingV1_1 = protoEvolvedRoot.lookupType("weather.v1.Reading");
const protoEvolvedBytes = ReadingV1_1.encode(ReadingV1_1.create(evolvedReading)).finish();
report("Protobuf (proto-evolution/v1.1, writer)", protoEvolvedBytes.length);
const decodedByOldReader = ReadingV1.decode(protoEvolvedBytes);
console.log(
  "Protobuf: old reader (v1 type) decoding v1.1-writer bytes ->",
  ReadingV1.toObject(decodedByOldReader),
  "(qualityFlag silently dropped, no error)",
);

// --- Avro: schema evolution is NOT automatic like Protobuf. The reader must
// declare a `default` for the new field and resolve OLD writer bytes against
// the NEW reader schema explicitly.
const avroV1_1Type = avro.Type.forSchema({
  type: "record",
  name: "Reading",
  fields: [
    { name: "id", type: "string" },
    { name: "stationId", type: "string" },
    { name: "observedAt", type: "string" },
    { name: "temperatureCelsius", type: "double" },
    { name: "qualityFlag", type: "string", default: "ok" },
  ],
});
const avroEvolvedBytes = avroV1_1Type.toBuffer(evolvedReading);
report("Avro (v1.1 schema, writer)", avroEvolvedBytes.length);
const resolver = avroV1_1Type.createResolver(avroV1Type);
const resolvedByNewReader = avroV1_1Type.fromBuffer(avroV1Bytes, resolver);
console.log(
  "Avro: NEW reader (v1.1 schema) resolving OLD writer (v1) bytes ->",
  resolvedByNewReader,
  "(qualityFlag filled from `default`)",
);
