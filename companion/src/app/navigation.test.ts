import { SECTIONS, sectionFromHash } from "./navigation";

describe("navigation", () => {
  it("has exactly the five approved sections in order", () => {
    expect(SECTIONS.map((s) => s.label)).toEqual(["Overview", "My Eyes", "Appointments", "Records", "Library"]);
  });
  it("falls back to Overview for unknown or unbuilt sections", () => {
    expect(sectionFromHash("#/my-eyes")).toBe("my-eyes");
    expect(sectionFromHash("#/library")).toBe("overview");
    expect(sectionFromHash("#/nonsense")).toBe("overview");
  });
});
