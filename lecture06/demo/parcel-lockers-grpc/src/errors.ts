// Szczegóły błędu w grpc-js: Go ma gotowe WithDetails, a tu bajty
// google.rpc.Status składa i czyta własny kod.
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

// Jedno naruszenie: pole z pliku .proto i opis dla człowieka.
export type Violation = { field: string; description: string };
// Tylko to, co odczyta klient: lista szczegółów, w BadRequest naruszenia.
type StatusMessage = { details: { fieldViolations: Violation[] }[] };

// google.rpc.Status i BadRequest z pakietu google-proto-files, ładowane
// tym samym proto-loaderem co kontrakt paczkomatów w proto.ts.
const files = ["google/rpc/status.proto", "google/rpc/error_details.proto"];
const definition = protoLoader.loadSync(files, {
  includeDirs: ["node_modules/google-proto-files"],
  json: true, // szczegół można podać jako obiekt z "@type"
});
// Status.serialize zamienia obiekt na bajty, deserialize bajty na obiekt.
const Status = definition["google.rpc.Status"] as
  protoLoader.MessageTypeDefinition<object, StatusMessage>;

// "@type" mówi odbiorcy, jakim komunikatem jest element typu Any.
const BAD_REQUEST = "type.googleapis.com/google.rpc.BadRequest";

// Błąd INVALID_ARGUMENT z listą naruszeń w metadanych.
export function invalidArgument(violations: Violation[]) {
  const code = grpc.status.INVALID_ARGUMENT; // liczba 3
  const details = "Invalid request"; // komunikat
  // Kod i komunikat stoją dwa razy: w bajtach Status i w obiekcie błędu.
  const status = Status.serialize({
    code,
    message: details,
    details: [{ "@type": BAD_REQUEST, fieldViolations: violations }],
  });
  const metadata = new grpc.Metadata();
  // Klucz z końcówką -bin przyjmuje tylko bajty (Buffer).
  metadata.set("grpc-status-details-bin", status);
  // Ten sam kształt co błąd NOT_FOUND, plus pole metadata.
  return { code, details, metadata };
}

// Wypisuje odpowiedź albo kod, komunikat i naruszenia z BadRequest.
// Leży w errors.ts, bo czyta szczegóły tą samą definicją Status.
export async function attempt(label: string, call: Promise<unknown>) {
  try {
    console.log(`${label}: ${JSON.stringify(await call)}`);
  } catch (e) {
    const error = e as grpc.ServiceError; // code, details, metadata
    // get zwraca listę wartości klucza; pierwsza albo undefined.
    const [bytes] = error.metadata.get("grpc-status-details-bin");
    const violations = bytes // bajty są tylko przy BadRequest
      ? Status.deserialize(bytes as Buffer).details[0].fieldViolations
      : [];
    const code = grpc.status[error.code]; // nazwa kodu: 5 to NOT_FOUND
    const list = JSON.stringify(violations);
    console.log(`${label}: ${code}, "${error.details}", violations ${list}`);
  }
}
