import { promisify } from "node:util";
import * as grpc from "@grpc/grpc-js";
import { lockersPackage } from "./proto.ts";

// Klient dostaje listę adresów i sam rozkłada wywołania: round_robin kieruje kolejne wywołania do kolejnych adresów.
const client = new lockersPackage.lockers.v1.LockerService("ipv4:127.0.0.1:50061,127.0.0.1:50063", grpc.credentials.createInsecure(), {
  "grpc.service_config": JSON.stringify({ loadBalancingConfig: [{ round_robin: {} }] }),
});
const getLocker = promisify(client.GetLocker).bind(client);

for (let i = 0; i < 100; i++) {
  await getLocker({ id: "WAW01" });
}
console.log("100 calls done");
client.close();
