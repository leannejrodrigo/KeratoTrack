import { buildExport, exportFileName, parseImport } from "./exportImport";
import { generateSyntheticMeasurements } from "../synthetic/generator";
import { syn } from "../test/factories";

const NOW = new Date("2026-11-07T18:00:00.000Z");

describe("JSON export/import", () => {
  it("round-trips the full synthetic dataset losslessly", () => {
    const data = generateSyntheticMeasurements();
    const file = buildExport(data, NOW);
    const result = parseImport(JSON.stringify(file));
    expect(result).toEqual({ ok: true, measurements: data });
  });

  it("labels synthetic exports in the envelope and the file name", () => {
    const file = buildExport([syn()], NOW);
    expect(file.synthetic).toBe(true);
    expect(file.notice).toMatch(/^SYNTHETIC DATA/);
    expect(exportFileName(file)).toBe("keratotrack-export-2026-11-07_SYNTHETIC.json");
  });

  it.each([
    ["not JSON", "{oops", /not valid JSON/],
    ["wrong format", JSON.stringify({ hello: 1 }), /not a KeratoTrack export/],
    ["newer version", JSON.stringify({ ...buildExport([], NOW), schemaVersion: 99 }), /newer version/],
  ])("rejects %s", (_label, text, message) => {
    const r = parseImport(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(message);
  });

  it("rejects the whole file if any record is invalid, naming the record", () => {
    const file = buildExport([syn(), syn()], NOW);
    (file.measurements[1] as { eye: string }).eye = "both";
    const r = parseImport(JSON.stringify(file));
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.error).toMatch(/Record 2.*Nothing was imported/);
  });

  it("rejects duplicate identifiers", () => {
    const m = syn();
    const r = parseImport(JSON.stringify(buildExport([m, m], NOW)));
    expect(r.ok).toBe(false);
  });

  it("rejects non-synthetic records while the real-data gate is closed", () => {
    const real = { ...syn(), id: "abc", synthetic: false, source: "enteredByUser" as const };
    const r = parseImport(JSON.stringify(buildExport([real], NOW)));
    expect(r.ok).toBe(false);
  });

  it("rejects a file whose synthetic label was edited to lie", () => {
    const file = { ...buildExport([syn()], NOW), synthetic: false };
    expect(parseImport(JSON.stringify(file)).ok).toBe(false);
  });
});
