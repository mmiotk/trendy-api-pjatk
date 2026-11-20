import http2 from "node:http2";

// Połączenie HTTP/2 z serwerem skrytek; http:// oznacza HTTP/2 bez TLS, tak jak createInsecure na serwerze.
const session = http2.connect("http://localhost:50061");

// GetLockerRequest { id: "WAW01" } zapisany ręcznie: tag 0a, długość 05 i pięć znaków.
const message = Buffer.concat([Buffer.from([0x0a, 0x05]), Buffer.from("WAW01")]);
// Prefiks ramki gRPC: bajt flagi kompresji (0) i długość komunikatu na czterech bajtach.
const prefix = Buffer.alloc(5); // pięć bajtów zerowych, więc bajt 0 (flaga kompresji) zostaje zerem
prefix.writeUInt32BE(message.length, 1); // długość 7 na bajtach 1–4, najstarszy bajt pierwszy (big endian)

// Wywołanie gRPC to zwykłe żądanie POST na ścieżkę /pakiet.Usługa/Metoda.
const stream = session.request({
  ":method": "POST",
  ":path": "/lockers.v1.LockerService/GetLocker",
  "content-type": "application/grpc", // inny typ treści serwer gRPC powinien odrzucić statusem HTTP 415
  te: "trailers", // wykrywa pośrednika, który nie przekazuje nagłówków końcowych
});
// stream.id to numer strumienia HTTP/2, który klient dostał dla tego wywołania.
stream.on("response", (headers) => console.log(`stream ${stream.id}, response headers:`, JSON.stringify(headers)));
// Odpowiedź jest krótka, więc przychodzi jednym kawałkiem: pięć bajtów prefiksu i komunikat.
stream.on("data", (chunk: Buffer) => {
  console.log("frame prefix:", chunk.subarray(0, 5).toString("hex"));
  console.log("message:", chunk.subarray(5).toString("hex"));
});
// Status wywołania leży w nagłówkach końcowych, po komunikacie.
stream.on("trailers", (trailers) => console.log("trailers:", JSON.stringify(trailers)));
stream.on("close", () => session.close()); // po wywołaniu zamyka całe połączenie, żeby proces mógł się zakończyć
stream.end(Buffer.concat([prefix, message])); // wysyła prefiks z komunikatem i kończy stronę klienta strumienia
