import { SECTIONS, sectionFromHash } from "./navigation";

describe("navigation", () => {
  it("has exactly the five approved sections in order", () => {
    expect(SECTIONS.map((s) => s.label)).toEqual(["Overview", "My Eyes", "Appointments", "Records", "Library"]);
  });
  it("routes to every section, built or not, and falls back to Overview", () => {
    expect(sectionFromHash("#/my-eyes")).toBe("my-eyes");
    expect(sectionFromHash("#/library")).toBe("library");
    expect(sectionFromHash("#/nonsense")).toBe("overview");
  });
});
