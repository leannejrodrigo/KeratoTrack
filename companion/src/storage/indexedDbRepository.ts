/**
 * IndexedDB implementation of the Repository, using the `idb` wrapper.
 *
 * IndexedDB's native API is event-based (onsuccess/onerror callbacks on
 * request objects). `idb` wraps the same API in Promises; it adds no storage
 * logic of its own, so what you read here maps one-to-one onto IndexedDB.
 *
 * Schema versioning: IndexedDB databases carry an integer version. Opening
 * with a higher number than is on disk triggers `upgrade`, the ONLY place
 * object stores and indexes may be created or changed. Each `if (oldVersion
 * < n)` block is a migration step; they run in order, so a user several
 * versions behind is upgraded step by step. Never edit a released step: add
 * a new one.
 *
 * Two separate databases (design-spec 8.1 and 12): synthetic demo data and
 * (in future) personal data never share a database, so clearing or exporting
 * one can never touch the other.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Measurement } from "../domain/measurement";
import { byDateThenCreated, checkWritable, type MeasurementRepository } from "./repository";

export type DatabaseMode = "demo" | "personal";

export const DATABASE_NAMES: Record<DatabaseMode, string> = {
  demo: "keratotrack-demo",
  personal: "keratotrack-personal",
};

export const DB_VERSION = 1;

interface KeratoTrackDB extends DBSchema {
  measurements: {
    key: string;
    value: Measurement;
    indexes: { byEyeKindDate: [string, string, string] };
  };
}

export async function openKeratoTrackDb(mode: DatabaseMode): Promise<IDBPDatabase<KeratoTrackDB>> {
  return openDB<KeratoTrackDB>(DATABASE_NAMES[mode], DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore("measurements", { keyPath: "id" });
        // Compound index: lets a future query fetch "OD, Kmax, in date order"
        // without scanning every record.
        store.createIndex("byEyeKindDate", ["eye", "kind", "date"]);
      }
    },
    blocked() {
      // Another tab holds an older version open. Surfaced by the caller.
      console.warn("KeratoTrack: database upgrade blocked by another open tab.");
    },
  });
}

export class IndexedDbMeasurementRepository implements MeasurementRepository {
  constructor(private readonly db: IDBPDatabase<KeratoTrackDB>) {}

  static async open(mode: DatabaseMode): Promise<IndexedDbMeasurementRepository> {
    if (mode === "personal") {
      // Not reachable from the MVP interface; belt and braces.
      throw new Error("The personal database is not available until real-data safeguards exist.");
    }
    return new IndexedDbMeasurementRepository(await openKeratoTrackDb(mode));
  }

  async list() {
    return (await this.db.getAll("measurements")).sort(byDateThenCreated);
  }
  async get(id: string) {
    return this.db.get("measurements", id);
  }
  async put(measurement: Measurement) {
    // Read and write in ONE readwrite transaction, so no other tab can change
    // the record between the immutability check and the write.
    const tx = this.db.transaction("measurements", "readwrite");
    const existing = await tx.store.get(measurement.id);
    const m = checkWritable(measurement, existing);
    await Promise.all([tx.store.put(m), tx.done]);
  }
  async delete(id: string) {
    await this.db.delete("measurements", id);
  }
  async replaceAll(measurements: Measurement[]) {
    const valid = measurements.map((m) => checkWritable(m)); // throws before any write
    // One transaction: if any put fails, IndexedDB aborts and rolls back the
    // clear as well. The user never ends up with half an import.
    const tx = this.db.transaction("measurements", "readwrite");
    await tx.store.clear();
    for (const m of valid) await tx.store.put(m);
    await tx.done;
  }
  async clear() {
    await this.db.clear("measurements");
  }
  close() {
    this.db.close();
  }
}
