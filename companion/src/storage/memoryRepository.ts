import type { Measurement } from "../domain/measurement";
import { byDateThenCreated, checkWritable, type MeasurementRepository } from "./repository";

/** In-memory implementation for tests. Same rules as IndexedDB. */
export class MemoryMeasurementRepository implements MeasurementRepository {
  private readonly rows = new Map<string, Measurement>();

  async list() {
    // structuredClone so callers cannot mutate stored records by accident,
    // which is what IndexedDB's own structured clone gives us for free.
    return [...this.rows.values()].map((m) => structuredClone(m)).sort(byDateThenCreated);
  }
  async get(id: string) {
    const m = this.rows.get(id);
    return m && structuredClone(m);
  }
  async put(measurement: Measurement) {
    const m = checkWritable(measurement, this.rows.get(measurement.id));
    this.rows.set(m.id, structuredClone(m));
  }
  async delete(id: string) {
    this.rows.delete(id);
  }
  async replaceAll(measurements: Measurement[]) {
    // Validate everything first; only then mutate. All or nothing.
    const valid = measurements.map((m) => checkWritable(m));
    this.rows.clear();
    for (const m of valid) this.rows.set(m.id, structuredClone(m));
  }
  async clear() {
    this.rows.clear();
  }
}
