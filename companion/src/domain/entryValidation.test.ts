import { EMPTY_DRAFT, validateDraft, type MeasurementDraft } from "./entryValidation";

const TODAY = "2026-11-07";
const good: MeasurementDraft = {
  kind: "kmax", eye: "OS", date: "2026-03-03", value: "48.2",
  deviceChoice: "named", deviceName: " Pentacam ", source: "clinicReport", note: "",
};

describe("validateDraft", () => {
  it("returns a clean entry for a valid draft", () => {
    const r = validateDraft(good, TODAY);
    expect(r).toEqual({ ok: true, entry: { kind: "kmax", eye: "OS", date: "2026-03-03", value: 48.2, device: "Pentacam", source: "clinicReport" } });
  });

  it("reports every missing required field", () => {
    const r = validateDraft(EMPTY_DRAFT, TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["date", "deviceChoice", "eye", "kind", "source", "value"]);
  });

  it("maps 'Device not recorded' to null", () => {
    const r = validateDraft({ ...good, deviceChoice: "notRecorded", deviceName: "ignored" }, TODAY);
    expect(r.ok && r.entry.device).toBe(null);
  });

  it("rejects future dates and impossible dates", () => {
    expect(validateDraft({ ...good, date: "2026-11-08" }, TODAY).ok).toBe(false);
    expect(validateDraft({ ...good, date: "2026-02-30" }, TODAY).ok).toBe(false);
    expect(validateDraft({ ...good, date: TODAY }, TODAY).ok).toBe(true);
  });

  it("catches the spec's typo example (Kmax 5.7 D) with entry-focused wording", () => {
    const r = validateDraft({ ...good, value: "5.7" }, TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.value).toMatch(/^Check this value/);
  });

  it("accepts a comma decimal separator", () => {
    const r = validateDraft({ ...good, value: "48,2" }, TODAY);
    expect(r.ok && r.entry.value).toBe(48.2);
  });

  it("enforces the reporting resolution", () => {
    expect(validateDraft({ ...good, value: "48.25" }, TODAY).ok).toBe(false);
    expect(validateDraft({ ...good, kind: "thinnestThickness", value: "471.5" }, TODAY).ok).toBe(false);
  });

  it("never uses clinical judgement words in any message (safety rule 3)", () => {
    const drafts: MeasurementDraft[] = [EMPTY_DRAFT, { ...good, value: "5.7" }, { ...good, value: "999" }, { ...good, kind: "thinnestThickness", value: "5" }, { ...good, date: "2030-01-01" }, { ...good, deviceName: "" }];
    const banned = /abnormal|normal|high|low|danger|risk|worse|improv|progress|stable|severe|concern/i;
    for (const d of drafts) {
      const r = validateDraft(d, TODAY);
      if (!r.ok) for (const msg of Object.values(r.errors)) expect(msg).not.toMatch(banned);
    }
  });
});
