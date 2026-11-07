import { measurementToDraft, validateDraft } from "../../domain/entryValidation";
import { MemoryMeasurementRepository } from "../../storage/memoryRepository";
import { StorageRuleError } from "../../storage/repository";
import { syn } from "../../test/factories";
import { applyEdit } from "./newMeasurement";

const TODAY = "2026-11-08";
const LATER = new Date("2026-11-08T12:00:00.000Z");

function roundTrip(m = syn({ value: 48, note: "kept" })) {
  const r = validateDraft(measurementToDraft(m), TODAY);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return { m, entry: r.entry };
}

describe("editing a measurement", () => {
  it("saving an unedited form reproduces the record (apart from updatedAt)", () => {
    const { m, entry } = roundTrip();
    expect(measurementToDraft(m).value).toBe("48.0"); // written at the kind's resolution
    expect(applyEdit(m, entry, LATER)).toEqual({ ...m, updatedAt: LATER.toISOString() });
  });

  it("round-trips 'Device not recorded'", () => {
    const { m, entry } = roundTrip(syn({ device: null }));
    expect(applyEdit(m, entry, LATER).device).toBeNull();
  });

  it("never changes id, createdAt or the synthetic flag", () => {
    const { m, entry } = roundTrip();
    const edited = applyEdit(m, { ...entry, value: 49.1, eye: "OS" }, LATER);
    expect([edited.id, edited.createdAt, edited.synthetic]).toEqual([m.id, m.createdAt, m.synthetic]);
    expect(edited.updatedAt).toBe(LATER.toISOString());
  });

  it("removes the note when it is cleared", () => {
    const { m, entry } = roundTrip();
    const { note: _n, ...withoutNote } = entry;
    expect("note" in applyEdit(m, withoutNote, LATER)).toBe(false);
  });

  it("sets the unit from the new kind when the kind changes", () => {
    const { m, entry } = roundTrip();
    const edited = applyEdit(m, { ...entry, kind: "thinnestThickness", value: 480 }, LATER);
    expect(edited.unit).toBe("µm");
  });

  it("is stored by the repository, which still guards identity", async () => {
    const repo = new MemoryMeasurementRepository();
    const { m, entry } = roundTrip();
    await repo.put(m);
    await repo.put(applyEdit(m, { ...entry, value: 49.1 }, LATER));
    expect((await repo.get(m.id))!.value).toBe(49.1);
    await expect(repo.put({ ...m, createdAt: LATER.toISOString() })).rejects.toBeInstanceOf(StorageRuleError);
  });
});
