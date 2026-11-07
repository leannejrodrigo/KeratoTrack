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

/**
 * Apply a validated edit to an existing record.
 *
 * Identity and history are preserved: id, createdAt and the synthetic flag
 * never change (the repository rejects any attempt), only updatedAt moves.
 * The note is set explicitly, so clearing it in the form really removes it;
 * spreading `entry` alone would silently keep the old note.
 */
export function applyEdit(original: Measurement, entry: ValidEntry, now = new Date()): Measurement {
  const { note: _oldNote, ...rest } = original;
  return {
    ...rest,
    kind: entry.kind,
    eye: entry.eye,
    date: entry.date,
    value: entry.value,
    unit: MEASUREMENT_KINDS[entry.kind].unit,
    device: entry.device,
    source: entry.source,
    ...(entry.note ? { note: entry.note } : {}),
    updatedAt: now.toISOString(),
  };
}
