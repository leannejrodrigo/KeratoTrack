/**
 * The Repository interface (ADR 0001).
 *
 * Feature code depends only on this interface, never on IndexedDB directly.
 * That gives us three things:
 *   1. Tests run against a fast in-memory implementation.
 *   2. The storage technology can change (an encrypted store, or a backend in
 *      a future version) without touching feature code.
 *   3. Rules that must hold whatever the UI does live in ONE place:
 *      every write is re-validated against the schema, and the MVP gate
 *      ("synthetic data only", design-spec section 12) is enforced here.
 */
import { measurementSchema, type Measurement } from "../domain/measurement";

export interface MeasurementRepository {
  list(): Promise<Measurement[]>;
  get(id: string): Promise<Measurement | undefined>;
  /** Insert or update. Validates; rejects non-synthetic data in the MVP. */
  put(measurement: Measurement): Promise<void>;
  delete(id: string): Promise<void>;
  /** Atomically replace every record (used by import). All or nothing. */
  replaceAll(measurements: Measurement[]): Promise<void>;
  clear(): Promise<void>;
}

export class StorageRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageRuleError";
  }
}

/**
 * Until encryption, backup, restore and deletion safeguards exist and are
 * tested, real health information is not accepted (design-spec section 12,
 * "Gate"). Flip this only through a reviewed change to that document.
 */
export const ACCEPTS_REAL_DATA = false;

export function checkWritable(candidate: unknown, existing?: Measurement): Measurement {
  const parsed = measurementSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new StorageRuleError(`Invalid measurement: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  const m = parsed.data;
  if (!ACCEPTS_REAL_DATA && !m.synthetic) {
    throw new StorageRuleError("This version stores synthetic (practice) data only. Real health information is not accepted yet.");
  }
  if (existing && existing.synthetic !== m.synthetic) {
    throw new StorageRuleError("The synthetic flag of a record cannot be changed after it is created.");
  }
  if (existing && existing.createdAt !== m.createdAt) {
    throw new StorageRuleError("createdAt cannot be changed after a record is created.");
  }
  return m;
}

/** Stable display order: by measurement date, then creation time. */
export function byDateThenCreated(a: Measurement, b: Measurement): number {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}
