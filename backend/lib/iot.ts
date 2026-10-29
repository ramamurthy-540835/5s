import { iotSignalUnits } from "../../frontend/config/iot-signals";

export type IotReading = {
  plantId: string;
  lineId: string;
  observedAt: string;
  signals: Record<string, number>;
};

const validIdentifier = (value: string) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value);
const maximumReadingAgeMs = 24 * 60 * 60 * 1000;
const maximumFutureSkewMs = 5 * 60 * 1000;

export function parseIotReading(input: unknown, now = Date.now()): IotReading {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Reading must be an object");
  const data = input as Record<string, unknown>;
  const plantId = String(data.plantId || "").trim();
  const lineId = String(data.lineId || "").trim();
  if (!validIdentifier(plantId) || !validIdentifier(lineId))
    throw new Error("Plant and line IDs must contain only letters, numbers, hyphens, or underscores");

  const observedAtValue = String(data.observedAt || "");
  const observedAtMs = Date.parse(observedAtValue);
  if (!Number.isFinite(observedAtMs) || observedAtMs < now - maximumReadingAgeMs || observedAtMs > now + maximumFutureSkewMs)
    throw new Error("Observed time must be within the last 24 hours and no more than 5 minutes in the future");

  if (!data.signals || typeof data.signals !== "object" || Array.isArray(data.signals))
    throw new Error("Signals must be an object");
  const sourceSignals = data.signals as Record<string, unknown>;
  const entries = Object.entries(sourceSignals);
  if (!entries.length || entries.length > 100) throw new Error("Provide between 1 and 100 signals");

  const signals: Record<string, number> = {};
  for (const [name, rawValue] of entries) {
    const unit = Object.prototype.hasOwnProperty.call(iotSignalUnits, name) ? iotSignalUnits[name] : undefined;
    if (!unit) throw new Error(`Unknown signal: ${name}`);
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) throw new Error(`Signal ${name} must be a finite number`);
    if (unit === "%" && (rawValue < 0 || rawValue > 100)) throw new Error(`Signal ${name} must be between 0 and 100`);
    signals[name] = rawValue;
  }

  return { plantId, lineId, observedAt: new Date(observedAtMs).toISOString(), signals };
}
