/**
 * SYNTHETIC demonstration data generator (design-spec 8.1; safety rule 6).
 *
 * Every value is invented by this code. Nothing is derived from any real
 * person's records. Each record has synthetic: true, a SYN- identifier and
 * the "syntheticDemo" source.
 *
 * The data is deliberately shaped to exercise the display rules, not to tell
 * a clinical story:
 *   - a device change partway through (connectors must break),
 *   - one entry with "Device not recorded" (no connectors through it),
 *   - a visit where only one kind was recorded (gaps stay visible),
 * Values are random walks around arbitrary starting points; they carry no
 * meaning and must never be described as showing change.
 */
import { MEASUREMENT_KINDS, type Eye, type Measurement, type MeasurementKind } from "../domain/measurement";
import { mulberry32, seededUuid } from "./random";

export const DEFAULT_SEED = 20261107;

interface Visit {
  date: string;
  device: string | null;
  kinds: MeasurementKind[];
  eyes: Eye[];
}

const VISITS: Visit[] = [
  { date: "2022-03-14", device: "Device A (synthetic)", kinds: ["kmax", "thinnestThickness"], eyes: ["OD", "OS"] },
  { date: "2022-09-20", device: "Device A (synthetic)", kinds: ["kmax", "thinnestThickness"], eyes: ["OD", "OS"] },
  { date: "2023-04-03", device: "Device A (synthetic)", kinds: ["kmax"], eyes: ["OD", "OS"] },
  { date: "2023-10-11", device: null, kinds: ["kmax", "thinnestThickness"], eyes: ["OD"] },
  { date: "2024-05-22", device: "Device B (synthetic)", kinds: ["kmax", "thinnestThickness"], eyes: ["OD", "OS"] },
  { date: "2025-02-17", device: "Device B (synthetic)", kinds: ["kmax", "thinnestThickness"], eyes: ["OD", "OS"] },
  { date: "2026-01-08", device: "Device B (synthetic)", kinds: ["kmax", "thinnestThickness"], eyes: ["OD", "OS"] },
];

const START: Record<Eye, Record<MeasurementKind, number>> = {
  OD: { kmax: 48.0, thinnestThickness: 470 },
  OS: { kmax: 45.5, thinnestThickness: 505 },
};
const STEP_SD: Record<MeasurementKind, number> = { kmax: 0.5, thinnestThickness: 6 };

export function generateSyntheticMeasurements(seed = DEFAULT_SEED, createdAt = "2026-11-07T00:00:00.000Z"): Measurement[] {
  const rand = mulberry32(seed);
  // Box-Muller transform: two uniform samples -> one standard normal sample.
  const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
  const current = structuredClone(START);
  const out: Measurement[] = [];

  for (const visit of VISITS) {
    for (const eye of visit.eyes) {
      for (const kind of visit.kinds) {
        const spec = MEASUREMENT_KINDS[kind];
        current[eye][kind] += normal() * STEP_SD[kind];
        const value = Math.round(current[eye][kind] / spec.resolution) * spec.resolution;
        out.push({
          id: `SYN-${seededUuid(rand)}`,
          kind,
          eye,
          date: visit.date,
          value: Number(value.toFixed(4)),
          unit: spec.unit,
          device: visit.device,
          source: "syntheticDemo",
          synthetic: true,
          createdAt,
          updatedAt: createdAt,
        });
      }
    }
  }
  return out;
}
