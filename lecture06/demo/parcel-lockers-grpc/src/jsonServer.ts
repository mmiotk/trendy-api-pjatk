import { createServer } from "node:http";
import { getLocker } from "./data.ts";

// Ta sama odpowiedź co GetLocker, ale jako JSON przez HTTP/1.1: GET /lockers/WAW01.
createServer((request, response) => {
  const id = request.url?.split("/")[2] ?? "";
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ locker: getLocker(id) }));
}).listen(4070, () => console.log("JSON server on port 4070"));
