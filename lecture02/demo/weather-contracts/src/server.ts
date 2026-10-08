import express from "express";
import type { Request, Response, NextFunction } from "express";
import * as OpenApiValidator from "express-openapi-validator";

// In-memory data: the last reading of a station is its latest one.
const readings = [
  { id: "rd-1001", stationId: "st-02", observedAt: "2026-09-25T09:00:00Z", temperatureCelsius: 3.5 },
  { id: "rd-1002", stationId: "st-01", observedAt: "2026-09-25T09:00:00Z", temperatureCelsius: 14.2 },
];

function addReading(stationId: string, temperatureCelsius: number) {
  const reading = {
    id: `rd-${1001 + readings.length}`,
    stationId,
    observedAt: new Date().toISOString(),
    temperatureCelsius,
  };
  readings.push(reading);
  return reading;
}

// v2 renames temperatureCelsius to temperatureValue + unit.
function toV2(reading: { id: string; stationId: string; observedAt: string; temperatureCelsius: number }) {
  return {
    id: reading.id,
    stationId: reading.stationId,
    observedAt: reading.observedAt,
    temperatureValue: reading.temperatureCelsius,
    unit: "celsius",
  };
}

const app = express();
app.use(express.json());

// /v1 is deprecated since /v2 is live; registered before the validators,
// so even a 400 from the validator carries these headers.
app.use("/v1", (_req, res, next) => {
  res.set("Deprecation", "@1688169599");
  res.set("Sunset", "Wed, 11 Nov 2026 11:11:11 GMT");
  res.set("Link", '<https://developer.example.com/deprecation>; rel="deprecation"');
  next();
});

// Each validator checks only the paths under its own `servers` url (/v1 or /v2).
app.use(
  OpenApiValidator.middleware({
    apiSpec: "contracts/openapi/weather.v1.yaml",
    validateRequests: true,
    validateResponses: true,
  }),
);
app.use(
  OpenApiValidator.middleware({
    apiSpec: "contracts/openapi/weather.v2.yaml",
    validateRequests: true,
    validateResponses: true,
  }),
);

app.get("/v1/stations/:stationId/readings/latest", (req, res) => {
  const reading = readings.findLast((r) => r.stationId === req.params.stationId);
  if (!reading) {
    res.status(404).json({ error: "station not found" });
    return;
  }
  res.json({ ...reading, qualityFlag: "ok" });
});

app.post("/v1/stations/:stationId/readings", (req, res) => {
  res.status(201).json(addReading(req.params.stationId, req.body.temperatureCelsius));
});

app.get("/v2/stations/:stationId/readings/latest", (req, res) => {
  const reading = readings.findLast((r) => r.stationId === req.params.stationId);
  if (!reading) {
    res.status(404).json({ error: "station not found" });
    return;
  }
  res.json(toV2(reading));
});

app.post("/v2/stations/:stationId/readings", (req, res) => {
  res.status(201).json(toV2(addReading(req.params.stationId, req.body.temperatureValue)));
});

// Turns validator errors (status + message) into JSON instead of Express's HTML page.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.status ?? 500).json({ error: err.message });
});

app.listen(3000, () => {
  console.log("Weather API on http://localhost:3000");
});
