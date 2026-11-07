import { generateSyntheticMeasurements } from "./generator";
import { measurementSchema } from "../domain/measurement";

describe("synthetic generator", () => {
  const data = generateSyntheticMeasurements();

  it("is deterministic for a seed", () => {
    expect(generateSyntheticMeasurements()).toEqual(data);
    expect(generateSyntheticMeasurements(1)).not.toEqual(data);
  });

  it("produces only valid, synthetic, SYN- records", () => {
    for (const m of data) {
      expect(measurementSchema.safeParse(m).success).toBe(true);
      expect(m.synthetic).toBe(true);
      expect(m.id.startsWith("SYN-")).toBe(true);
      expect(m.source).toBe("syntheticDemo");
    }
  });

  it("includes the cases the display rules must handle", () => {
    expect(data.some((m) => m.device === null)).toBe(true);
    expect(new Set(data.map((m) => m.device)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(data.map((m) => m.id)).size).toBe(data.length);
  });
});
