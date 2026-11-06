import http2 from "node:http2";

// Jedno połączenie HTTP/2 z serwerem, wspólne dla wszystkich wywołań poniżej.
const session = http2.connect("http://localhost:50061");

function call(id: string): Promise<void> {
  // GetLockerRequest { id } zapisany ręcznie: tag 0a, długość, znaki.
  const message = Buffer.concat([Buffer.from([0x0a, id.length]), Buffer.from(id)]);
  // Prefiks ramki gRPC: bajt flagi kompresji (0) i długość komunikatu na czterech bajtach.
  const prefix = Buffer.alloc(5);
  prefix.writeUInt32BE(message.length, 1);

  return new Promise((resolve) => {
    // Wywołanie gRPC to zwykłe żądanie POST na ścieżkę /pakiet.Usługa/Metoda.
    const stream = session.request({
      ":method": "POST",
      ":path": "/lockers.v1.LockerService/GetLocker",
      "content-type": "application/grpc",
      te: "trailers",
    });
    stream.on("response", (headers) => {
      console.log(`stream ${stream.id}, request headers:`, JSON.stringify(stream.sentHeaders));
      console.log("response headers:", JSON.stringify(headers));
    });
    // Odpowiedź jest krótka, więc przychodzi jednym kawałkiem: pięć bajtów prefiksu i komunikat.
    stream.on("data", (chunk: Buffer) => {
      console.log("frame prefix:", chunk.subarray(0, 5).toString("hex"));
      console.log("message:", chunk.subarray(5).toString("hex"));
    });
    // Status wywołania leży w nagłówkach końcowych, po komunikacie.
    stream.on("trailers", (trailers) => console.log("trailers:", JSON.stringify(trailers)));
    stream.on("close", resolve);
    stream.end(Buffer.concat([prefix, message]));
  });
}

// Trzy wywołania w jednym połączeniu: kolejne strumienie dostają kolejne numery nieparzyste.
for (const id of ["WAW01", "KRK01", "WAW01"]) {
  await call(id);
  console.log("local port of the connection:", session.socket.localPort);
}
session.close();
