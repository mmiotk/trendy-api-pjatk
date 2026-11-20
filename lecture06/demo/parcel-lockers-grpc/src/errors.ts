import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

// Naruszenie jednej reguły: nazwa pola i opis dla człowieka.
export interface Violation {
  field: string; // nazwa pola jak w pliku .proto, np. postal_code
  description: string;
}

// Kształt odczytanego google.rpc.Status: lista szczegółów, a w BadRequest lista naruszeń pól.
interface StatusMessage {
  details: { fieldViolations: Violation[] }[];
}

// google.rpc.Status i BadRequest z pakietu google-proto-files; json: true pozwala podać szczegół jako obiekt z polem "@type".
const definition = protoLoader.loadSync(["google/rpc/status.proto", "google/rpc/error_details.proto"], {
  includeDirs: ["node_modules/google-proto-files"], // katalog pakietu, w którym leżą obie ścieżki
  json: true,
});
// Definicja komunikatu daje serialize (obiekt na bajty) i deserialize (bajty na obiekt).
const Status = definition["google.rpc.Status"] as protoLoader.MessageTypeDefinition<object, StatusMessage>;

// Serwer: kod INVALID_ARGUMENT, komunikat i BadRequest w metadanych pod kluczem grpc-status-details-bin.
export function invalidArgument(violations: Violation[]) {
  const status = Status.serialize({
    code: grpc.status.INVALID_ARGUMENT, // ten sam kod co w obiekcie błędu zwracanym niżej
    message: "Invalid request",
    // "@type" mówi odbiorcy, jakim komunikatem jest element typu Any.
    details: [{ "@type": "type.googleapis.com/google.rpc.BadRequest", fieldViolations: violations }],
  });
  const metadata = new grpc.Metadata();
  metadata.set("grpc-status-details-bin", status); // klucz z końcówką -bin przyjmuje tylko Buffer
  // Obiekt błędu dla callbacku: kod i komunikat jak przy NOT_FOUND, a szczegóły w metadanych.
  return { code: grpc.status.INVALID_ARGUMENT, details: "Invalid request", metadata };
}

// Klient: wypisuje odpowiedź albo kod statusu, komunikat i naruszenia z BadRequest (pusta lista, gdy ich nie ma).
export async function attempt(label: string, call: Promise<unknown>): Promise<void> {
  try {
    console.log(`${label}: ${JSON.stringify(await call)}`);
  } catch (e) {
    const error = e as grpc.ServiceError; // błąd wywołania gRPC z polami code, details i metadata
    const [bytes] = error.metadata.get("grpc-status-details-bin"); // pierwsza wartość pod kluczem albo undefined
    // deserialize zamienia bajty z powrotem w Status; pierwszy szczegół to BadRequest.
    const violations = bytes ? Status.deserialize(bytes as Buffer).details[0].fieldViolations : [];
    // grpc.status[liczba] daje nazwę kodu (5 to NOT_FOUND); error.details to komunikat tekstowy.
    console.log(`${label}: ${grpc.status[error.code]}, "${error.details}", violations ${JSON.stringify(violations)}`);
  }
}
