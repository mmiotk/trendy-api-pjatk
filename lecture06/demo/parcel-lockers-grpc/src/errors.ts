import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

// Jedno naruszenie: pole z pliku .proto i opis dla człowieka.
export type Violation = { field: string; description: string };
type StatusMessage = { details: { fieldViolations: Violation[] }[] };

// google.rpc.Status i BadRequest z pakietu google-proto-files.
const files = ["google/rpc/status.proto", "google/rpc/error_details.proto"];
const definition = protoLoader.loadSync(files, {
  includeDirs: ["node_modules/google-proto-files"],
  json: true, // szczegół można podać jako obiekt z "@type"
});
const Status = definition["google.rpc.Status"] as
  protoLoader.MessageTypeDefinition<object, StatusMessage>;

const BAD_REQUEST = "type.googleapis.com/google.rpc.BadRequest";

// Błąd INVALID_ARGUMENT z listą naruszeń w metadanych.
export function invalidArgument(violations: Violation[]) {
  const code = grpc.status.INVALID_ARGUMENT; // liczba 3
  const details = "Invalid request"; // komunikat
  const status = Status.serialize({
    code,
    message: details,
    details: [{ "@type": BAD_REQUEST, fieldViolations: violations }],
  });
  const metadata = new grpc.Metadata();
  metadata.set("grpc-status-details-bin", status); // -bin: bajty
  return { code, details, metadata };
}

// Wypisuje odpowiedź albo kod, komunikat i naruszenia z BadRequest.
export async function attempt(label: string, call: Promise<unknown>) {
  try {
    console.log(`${label}: ${JSON.stringify(await call)}`);
  } catch (e) {
    const error = e as grpc.ServiceError; // code, details, metadata
    const [bytes] = error.metadata.get("grpc-status-details-bin");
    const violations = bytes // bajty są tylko przy BadRequest
      ? Status.deserialize(bytes as Buffer).details[0].fieldViolations
      : [];
    const code = grpc.status[error.code]; // nazwa kodu, np. NOT_FOUND
    const list = JSON.stringify(violations);
    console.log(`${label}: ${code}, "${error.details}", violations ${list}`);
  }
}
