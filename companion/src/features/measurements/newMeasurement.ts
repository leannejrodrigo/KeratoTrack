import type { ValidEntry } from "../../domain/entryValidation";
import { MEASUREMENT_KINDS, type Measurement } from "../../domain/measurement";

/**
 * Turns a validated form entry into a stored record. In the MVP every
 * user-entered record is practice data: synthetic: true with a SYN- id.
 * The repository would refuse anything else anyway; this just builds it right.
 */
export function newPracticeMeasurement(entry: ValidEntry, now = new Date(), uuid = () => crypto.randomUUID()): Measurement {
  const ts = now.toISOString();
  return {
    id: `SYN-${uuid()}`,
    ...entry,
    unit: MEASUREMENT_KINDS[entry.kind].unit,
    synthetic: true,
    createdAt: ts,
    updatedAt: ts,
  };
}
