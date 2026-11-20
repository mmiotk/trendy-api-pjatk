import http2 from "node:http2";

const session = http2.connect("http://localhost:50061"); // HTTP/2 bez TLS
const stream = session.request({
  // Ścieżka: pakiet.Usługa/Metoda z pliku .proto.
  ":method": "POST", ":path": "/lockers.v1.LockerService/GetLocker",
  // Inny typ treści serwer gRPC powinien odrzucić statusem HTTP 415.
  "content-type": "application/grpc",
  te: "trailers", // wykrywa pośrednika, który gubi nagłówki końcowe
});
stream.on("response", (h) =>
  console.log(`stream ${stream.id}, response headers:`, JSON.stringify(h)));
stream.on("data", (chunk: Buffer) => {
  console.log("frame prefix:", chunk.subarray(0, 5).toString("hex"));
  console.log("message:", chunk.subarray(5).toString("hex"));
});
stream.on("trailers", (t) => console.log("trailers:", JSON.stringify(t)));
// Otwarta sesja HTTP/2 nie pozwoliłaby procesowi się zakończyć.
stream.on("close", () => session.close());
// Prefiks: flaga 00 i długość 7; komunikat: 0a 05 i "WAW01"
// end wysyła treść i kończy stronę klienta strumienia.
stream.end(Buffer.from("0000000007" + "0a05" + "5741573031", "hex"));
