import { formatDate, formatValue, isRealCalendarDate, measurementSchema, provenanceText } from "./measurement";
import { syn } from "../test/factories";

describe("measurementSchema", () => {
  it("accepts a complete synthetic record", () => {
    expect(measurementSchema.safeParse(syn()).success).toBe(true);
  });

  it.each(["date", "eye", "device", "source"] as const)("requires %s (safety rule 5)", (field) => {
    const { [field]: _omitted, ...rest } = syn();
    expect(measurementSchema.safeParse(rest).success).toBe(false);
  });

  it("accepts device: null as an explicit 'not recorded'", () => {
    expect(measurementSchema.safeParse(syn({ device: null })).success).toBe(true);
  });

  it("rejects a unit that does not belong to the kind", () => {
    expect(measurementSchema.safeParse(syn({ kind: "kmax", unit: "µm" })).success).toBe(false);
  });

  it("ties the synthetic flag to the SYN- prefix in both directions", () => {
    expect(measurementSchema.safeParse(syn({ id: "abc", synthetic: true })).success).toBe(false);
    expect(measurementSchema.safeParse(syn({ id: "SYN-1", synthetic: false, source: "enteredByUser" })).success).toBe(false);
  });

  it("rejects unknown fields (strict), so imports cannot smuggle data in", () => {
    expect(measurementSchema.safeParse({ ...syn(), riskScore: 0.9 }).success).toBe(false);
  });

  it("rejects impossible calendar dates", () => {
    expect(isRealCalendarDate("2026-02-29")).toBe(false);
    expect(isRealCalendarDate("2024-02-29")).toBe(true);
    expect(measurementSchema.safeParse(syn({ date: "2026-02-30" })).success).toBe(false);
  });
});

describe("formatting", () => {
  it("formats dates unambiguously", () => {
    expect(formatDate("2026-03-03")).toBe("3 Mar 2026");
  });
  it("formats to the kind's resolution", () => {
    expect(formatValue({ kind: "kmax", value: 48.2 })).toBe("48.2 D");
    expect(formatValue({ kind: "thinnestThickness", value: 471 })).toBe("471 µm");
  });
  it("produces the full provenance sentence", () => {
    expect(provenanceText(syn({ date: "2026-03-03", value: 48.2, device: "Pentacam" }))).toBe(
      "Kmax, right eye (OD): 48.2 D, 3 Mar 2026, Pentacam, synthetic demonstration data",
    );
  });
});
