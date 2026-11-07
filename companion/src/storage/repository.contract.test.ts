/**
 * Contract tests: the SAME suite runs against every Repository
 * implementation. If the in-memory fake and IndexedDB ever behave
 * differently, a test here fails, so tests that use the fake stay honest.
 * IndexedDB is provided in Node by `fake-indexeddb` (see src/test/setup.ts).
 */
import { MemoryMeasurementRepository } from "./memoryRepository";
import { IndexedDbMeasurementRepository, openKeratoTrackDb } from "./indexedDbRepository";
import { StorageRuleError, type MeasurementRepository } from "./repository";
import { syn } from "../test/factories";

const implementations: [string, () => Promise<MeasurementRepository>][] = [
  ["memory", async () => new MemoryMeasurementRepository()],
  [
    "indexedDB",
    async () => {
      const repo = await IndexedDbMeasurementRepository.open("demo");
      await repo.clear();
      return repo;
    },
  ],
];

describe.each(implementations)("Repository contract: %s", (_name, make) => {
  let repo: MeasurementRepository;
  beforeEach(async () => {
    repo = await make();
  });

  it("round-trips a record losslessly", async () => {
    const m = syn({ note: "Synthetic note", device: null });
    await repo.put(m);
    expect(await repo.get(m.id)).toEqual(m);
  });

  it("lists in measurement-date order", async () => {
    await repo.put(syn({ id: "SYN-b", date: "2025-06-01" }));
    await repo.put(syn({ id: "SYN-a", date: "2024-01-01" }));
    expect((await repo.list()).map((m) => m.id)).toEqual(["SYN-a", "SYN-b"]);
  });

  it("refuses non-synthetic records while the real-data gate is closed", async () => {
    await expect(repo.put(syn({ id: "real-1", synthetic: false, source: "enteredByUser" }))).rejects.toBeInstanceOf(StorageRuleError);
  });

  it("refuses invalid records even if TypeScript was bypassed", async () => {
    await expect(repo.put({ ...syn(), eye: "XX" } as never)).rejects.toBeInstanceOf(StorageRuleError);
  });

  it("keeps createdAt immutable", async () => {
    const m = syn();
    await repo.put(m);
    await expect(repo.put({ ...m, createdAt: "2020-01-01T00:00:00.000Z" })).rejects.toBeInstanceOf(StorageRuleError);
  });

  it("replaceAll is all-or-nothing", async () => {
    await repo.put(syn({ id: "SYN-keep" }));
    await expect(repo.replaceAll([syn({ id: "SYN-new" }), { ...syn(), value: Number.NaN }])).rejects.toBeInstanceOf(StorageRuleError);
    expect((await repo.list()).map((m) => m.id)).toEqual(["SYN-keep"]);
  });

  it("deletes and clears", async () => {
    const m = syn();
    await repo.put(m);
    await repo.delete(m.id);
    expect(await repo.get(m.id)).toBeUndefined();
    await repo.put(syn());
    await repo.clear();
    expect(await repo.list()).toEqual([]);
  });
});

describe("IndexedDB specifics", () => {
  it("creates the store and compound index in the v1 migration", async () => {
    const db = await openKeratoTrackDb("demo");
    expect([...db.objectStoreNames]).toEqual(["measurements"]);
    const tx = db.transaction("measurements");
    expect([...tx.store.indexNames]).toEqual(["byEyeKindDate"]);
    db.close();
  });

  it("will not open the personal database in the MVP", async () => {
    await expect(IndexedDbMeasurementRepository.open("personal")).rejects.toThrow(/not available/);
  });
});
