import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

// Naruszenie jednej reguły: nazwa pola i opis dla człowieka.
export interface Violation {
  field: string;
  description: string;
}

// Kształt odczytanego google.rpc.Status: lista szczegółów, a w BadRequest lista naruszeń pól.
interface StatusMessage {
  details: { fieldViolations: Violation[] }[];
}

// google.rpc.Status i BadRequest z pakietu google-proto-files; json: true pozwala podać szczegół jako obiekt z polem "@type".
const definition = protoLoader.loadSync(["google/rpc/status.proto", "google/rpc/error_details.proto"], {
  includeDirs: ["node_modules/google-proto-files"],
  json: true,
});
const Status = definition["google.rpc.Status"] as protoLoader.MessageTypeDefinition<object, StatusMessage>;

// Serwer: kod INVALID_ARGUMENT, komunikat i BadRequest w metadanych pod kluczem grpc-status-details-bin.
export function invalidArgument(violations: Violation[]) {
  const status = Status.serialize({
    code: grpc.status.INVALID_ARGUMENT,
    message: "Invalid request",
    details: [{ "@type": "type.googleapis.com/google.rpc.BadRequest", fieldViolations: violations }],
  });
  const metadata = new grpc.Metadata();
  metadata.set("grpc-status-details-bin", status);
  return { code: grpc.status.INVALID_ARGUMENT, details: "Invalid request", metadata };
}

// Klient: wypisuje odpowiedź albo kod statusu, komunikat i naruszenia z BadRequest (pusta lista, gdy ich nie ma).
export async function attempt(label: string, call: Promise<unknown>): Promise<void> {
  try {
    console.log(`${label}: ${JSON.stringify(await call)}`);
  } catch (e) {
    const error = e as grpc.ServiceError;
    const [bytes] = error.metadata.get("grpc-status-details-bin");
    const violations = bytes ? Status.deserialize(bytes as Buffer).details[0].fieldViolations : [];
    console.log(`${label}: ${grpc.status[error.code]}, "${error.details}", violations ${JSON.stringify(violations)}`);
  }
}
