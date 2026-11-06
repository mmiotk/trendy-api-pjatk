import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

export interface Violation {
  field: string;
  description: string;
}

// Kształt komunikatu google.rpc.Status po stronie kodu; każdy szczegół ma nazwę typu w polu "@type".
interface StatusMessage {
  code: number;
  message: string;
  details: { "@type": string; fieldViolations?: Violation[] }[];
}

// Definicja ładowana dynamicznie, jak każdy plik .proto. Opcja json: true pozwala zapisać i odczytać szczegół
// po nazwie typu z pola "@type", a BadRequest to jeden z gotowych typów szczegółów w error_details.proto.
const definition = protoLoader.loadSync(["google/rpc/status.proto", "google/rpc/error_details.proto"], {
  includeDirs: ["node_modules/google-proto-files"],
  json: true,
});
// serialize zamienia obiekt w bajty Protobuf, deserialize zamienia bajty z powrotem w obiekt.
const Status = definition["google.rpc.Status"] as protoLoader.MessageTypeDefinition<StatusMessage, StatusMessage>;

// Błąd INVALID_ARGUMENT: komunikat dla człowieka i szczegóły dla programu (pola, które naruszyły regułę).
export function invalidArgument(message: string, violations: Violation[]) {
  const status = Status.serialize({
    code: grpc.status.INVALID_ARGUMENT,
    message,
    details: [{ "@type": "type.googleapis.com/google.rpc.BadRequest", fieldViolations: violations }],
  });
  // `details` w błędzie grpc-js to komunikat tekstowy; szczegóły (BadRequest) jadą w metadanych, czyli parach
  // klucz-wartość wysyłanych z odpowiedzią, pod kluczem grpc-status-details-bin (końcówka -bin: wartość binarna).
  const metadata = new grpc.Metadata();
  metadata.set("grpc-status-details-bin", status);
  return { code: grpc.status.INVALID_ARGUMENT, details: message, metadata };
}

// Czyta z błędu po stronie klienta listę naruszeń z BadRequest; pusta, gdy serwer nie dołączył szczegółów.
export function readViolations(error: grpc.ServiceError): Violation[] {
  const [bytes] = error.metadata.get("grpc-status-details-bin");
  if (!(bytes instanceof Buffer)) return [];
  return Status.deserialize(bytes).details.flatMap((detail) => detail.fieldViolations ?? []);
}

// Wykonuje wywołanie i wypisuje wynik albo kod statusu, komunikat i szczegóły błędu.
export async function attempt(label: string, call: Promise<unknown>): Promise<void> {
  try {
    console.log(`${label}: ${JSON.stringify(await call)}`);
  } catch (error) {
    const { code, details } = error as grpc.ServiceError;
    console.log(`${label}: ${grpc.status[code]}, "${details}", violations ${JSON.stringify(readViolations(error as grpc.ServiceError))}`);
  }
}
