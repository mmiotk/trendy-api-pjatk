import http2 from "node:http2";

const session = http2.connect("http://localhost:50061"); // HTTP/2 bez TLS
const stream = session.request({
  ":method": "POST", ":path": "/lockers.v1.LockerService/GetLocker",
  "content-type": "application/grpc", te: "trailers",
});
stream.on("response", (h) =>
  console.log(`stream ${stream.id}, response headers:`, JSON.stringify(h)));
stream.on("data", (chunk: Buffer) => {
  console.log("frame prefix:", chunk.subarray(0, 5).toString("hex"));
  console.log("message:", chunk.subarray(5).toString("hex"));
});
stream.on("trailers", (t) => console.log("trailers:", JSON.stringify(t)));
stream.on("close", () => session.close()); // proces może się zakończyć
// Prefiks: flaga 00 i długość 7; komunikat: 0a 05 i "WAW01"
stream.end(Buffer.from("0000000007" + "0a05" + "5741573031", "hex"));
