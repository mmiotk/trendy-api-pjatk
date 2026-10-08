// Segment 6: consolidates server.ts + server-v2.ts behind ONE app, versioned
// by PATH — /v1 serves contracts/openapi/weather.v1.1.yaml, /v2 serves
// contracts/openapi/weather.v2.yaml. Each version gets its OWN
// express-openapi-validator instance, so each is checked against its own
// contract independently. This is the SAME two servers from segment 5,
// merged into one deployable app instead of two ports.
//
// v1 moves from unprefixed (segments 0-5) to /v1 — every script written
// against the old root URL needs a one-line BASE_URL update from here on.
// That update IS the point: introducing a version prefix has a real cost
// for every existing caller, even a fully compatible one like v1 -> v1.1.
import express from "express";
import type { Request, Response, NextFunction } from "express";
import * as OpenApiValidator from "express-openapi-validator";
import { findStation, latestReading, nextReadingId, readings, stations } from "./data.ts";

const app = express();
app.use(express.json());

// --- /v1 — contracts/openapi/weather.v1.1.yaml (temperatureCelsius) -------
const v1Router = express.Router();

// /v2 (2.0.0) is live, so /v1 is deprecated: every /v1 response announces
// the retirement date. Registered BEFORE the validator, so even a 400 from
// the validator carries these headers. /v2 responses do not get them.
v1Router.use((_req, res, next) => {
  res.set("Deprecation", "@1688169599");
  res.set("Sunset", "Wed, 11 Nov 2026 11:11:11 GMT");
  res.set("Link", '<https://developer.example.com/deprecation>; rel="deprecation"');
  next();
});

v1Router.use(
  OpenApiValidator.middleware({
    apiSpec: "./contracts/openapi/weather.v1.1.yaml",
    validateRequests: true,
    validateResponses: true,
  }),
);

v1Router.get("/stations", (_req: Request, res: Response) => {
  res.json({ data: stations });
});

v1Router.get("/stations/:stationId", (req: Request, res: Response) => {
  const station = findStation(req.params.stationId as string);
  if (!station) {
    res.status(404).json({ error: "station not found" });
    return;
  }
  res.json(station);
});

v1Router.get("/stations/:stationId/readings/latest", (req: Request, res: Response) => {
  const stationId = req.params.stationId as string;
  const station = findStation(stationId);
  if (!station) {
    res.status(404).json({ error: "station not found" });
    return;
  }
  const reading = latestReading(stationId);
  if (!reading) {
    res.status(404).json({ error: "no readings for this station" });
    return;
  }
  res.json({ ...reading, qualityFlag: "ok" });
});

v1Router.post("/stations/:stationId/readings", (req: Request, res: Response) => {
  const stationId = req.params.stationId as string;
  const station = findStation(stationId);
  if (!station) {
    res.status(404).json({ error: "station not found" });
    return;
  }
  const reading = {
    id: nextReadingId(),
    stationId: station.id,
    observedAt: new Date().toISOString(),
    temperatureCelsius: req.body.temperatureCelsius,
  };
  readings.push(reading);
  res.status(201).json({ ...reading, qualityFlag: "ok" });
});

app.use("/v1", v1Router);

// --- /v2 — contracts/openapi/weather.v2.yaml (temperatureValue + unit) ----
const v2Router = express.Router();
v2Router.use(
  OpenApiValidator.middleware({
    apiSpec: "./contracts/openapi/weather.v2.yaml",
    validateRequests: true,
    validateResponses: true,
  }),
);

function toV2Reading(reading: { id: string; stationId: string; observedAt: string; temperatureCelsius: number }) {
  return {
    id: reading.id,
    stationId: reading.stationId,
    observedAt: reading.observedAt,
    temperatureValue: reading.temperatureCelsius,
    unit: "celsius" as const,
  };
}

v2Router.get("/stations", (_req: Request, res: Response) => {
  res.json({ data: stations });
});

v2Router.get("/stations/:stationId", (req: Request, res: Response) => {
  const station = findStation(req.params.stationId as string);
  if (!station) {
    res.status(404).json({ error: "station not found" });
    return;
  }
  res.json(station);
});

v2Router.get("/stations/:stationId/readings/latest", (req: Request, res: Response) => {
  const stationId = req.params.stationId as string;
  const station = findStation(stationId);
  if (!station) {
    res.status(404).json({ error: "station not found" });
    return;
  }
  const reading = latestReading(stationId);
  if (!reading) {
    res.status(404).json({ error: "no readings for this station" });
    return;
  }
  res.json(toV2Reading(reading));
});

v2Router.post("/stations/:stationId/readings", (req: Request, res: Response) => {
  const stationId = req.params.stationId as string;
  const station = findStation(stationId);
  if (!station) {
    res.status(404).json({ error: "station not found" });
    return;
  }
  const reading = {
    id: nextReadingId(),
    stationId: station.id,
    observedAt: new Date().toISOString(),
    temperatureCelsius: req.body.temperatureValue,
  };
  readings.push(reading);
  res.status(201).json(toV2Reading(reading));
});

app.use("/v2", v2Router);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.status ?? 500).json({
    error: err.message,
    details: err.errors,
  });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`weather-contracts API listening on http://localhost:${port} (/v1 and /v2)`);
});
