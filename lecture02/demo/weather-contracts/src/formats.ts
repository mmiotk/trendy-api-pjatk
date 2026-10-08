import protobuf from "protobufjs";
import avro from "avsc";

const reading = { id: "rd-1002", stationId: "st-01", observedAt: "2026-09-25T09:00:00Z", temperatureCelsius: 14.2 };
const evolved = { ...reading, qualityFlag: "ok" };

function report(label: string, bytes: number) {
  console.log(`${label.padEnd(36)} ${String(bytes).padStart(3)} bytes`);
}

// JSON: field names travel with every record.
report("JSON", Buffer.byteLength(JSON.stringify(reading)));
report("JSON + qualityFlag", Buffer.byteLength(JSON.stringify(evolved)));

// Protobuf: old reader = released v1 snapshot (4 fields), writer = current .proto (with field 5).
const oldProto = await protobuf.load("contracts/proto-evolution/v1/weather/v1/weather.proto");
const newProto = await protobuf.load("contracts/proto/weather/v1/weather.proto");
const OldReading = oldProto.lookupType("weather.v1.Reading");
const NewReading = newProto.lookupType("weather.v1.Reading");
const protoBytes = NewReading.encode(NewReading.create(reading)).finish();
const protoEvolvedBytes = NewReading.encode(NewReading.create(evolved)).finish();
report("Protobuf", protoBytes.length);
report("Protobuf + qualityFlag", protoEvolvedBytes.length);

// Avro: values only, in schema order; the new field needs a default.
const fields = [
  { name: "id", type: "string" },
  { name: "stationId", type: "string" },
  { name: "observedAt", type: "string" },
  { name: "temperatureCelsius", type: "double" },
];
const AvroOld = avro.Type.forSchema({ type: "record", name: "Reading", fields });
const AvroNew = avro.Type.forSchema({
  type: "record",
  name: "Reading",
  fields: [...fields, { name: "qualityFlag", type: "string", default: "ok" }],
});
const avroBytes = AvroOld.toBuffer(reading);
report("Avro", avroBytes.length);
report("Avro + qualityFlag", AvroNew.toBuffer(evolved).length);

console.log("Protobuf hex:", Buffer.from(protoBytes).toString("hex"));
console.log("Avro hex:    ", avroBytes.toString("hex"));

// Old reader skips the unknown field 5; new Avro reader fills the missing field from `default`.
console.log("Protobuf old reader:", OldReading.toObject(OldReading.decode(protoEvolvedBytes)));
console.log("Avro new reader, old bytes:", AvroNew.fromBuffer(avroBytes, AvroNew.createResolver(AvroOld)));
