import http from "node:http";
import { promisify } from "node:util";
import * as grpc from "@grpc/grpc-js";
import { getLocker } from "./data.ts";
import { lockersDefinition, lockersPackage } from "./proto.ts";

const client = new lockersPackage.lockers.v1.LockerService("localhost:50061", grpc.credentials.createInsecure());
const getLockerRpc = promisify(client.GetLocker).bind(client);

// Drugi klient JSON: node:http z utrzymywanym połączeniem, bliżej surowego HTTP/1.1 niż fetch.
const agent = new http.Agent({ keepAlive: true });
const getJson = () =>
  new Promise<string>((resolve) => {
    http.get("http://localhost:4070/lockers/WAW01", { agent }, (response) => {
      let body = "";
      response.on("data", (chunk) => (body += chunk));
      response.on("end", () => resolve(body));
    });
  });

// Mierzy serię wywołań jedno po drugim; pierwsze 100 rozgrzewa połączenie i nie jest liczone.
async function measure(name: string, call: () => Promise<unknown>): Promise<void> {
  for (let i = 0; i < 100; i++) await call();
  const start = performance.now();
  for (let i = 0; i < 1000; i++) await call();
  console.log(`${name}: ${(performance.now() - start).toFixed(1)} ms for 1000 calls`);
}

await measure("local function", async () => getLocker("WAW01"));
await measure("JSON over HTTP/1.1, fetch", async () => (await fetch("http://localhost:4070/lockers/WAW01")).json());
await measure("JSON over HTTP/1.1, node:http", getJson);
await measure("Protobuf over gRPC", () => getLockerRpc({ id: "WAW01" }));

// Bajty treści tej samej odpowiedzi: JSON z serwera i komunikat Protobuf bez prefiksu ramki.
const json = await getJson();
const method = (lockersDefinition["lockers.v1.LockerService"] as grpc.ServiceDefinition).GetLocker;
const message = method.responseSerialize({ locker: getLocker("WAW01") });
console.log(`JSON body: ${Buffer.byteLength(json)} bytes, Protobuf message: ${message.length} bytes`);
agent.destroy();
client.close();
