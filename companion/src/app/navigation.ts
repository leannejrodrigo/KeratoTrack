/**
 * Companion navigation (design-spec 5.1). Exactly five sections, in this
 * order; a test enforces both. Per the spec, a section is SHOWN only once it
 * is built, so the rail never offers an empty page.
 */
export type SectionId = "overview" | "my-eyes" | "appointments" | "records" | "library";

export interface Section {
  id: SectionId;
  label: string;
  built: boolean;
  /** Roadmap phase that builds it, for the docs and the not-yet-built check. */
  phase: string;
}

export const SECTIONS: readonly Section[] = [
  { id: "overview", label: "Overview", built: true, phase: "C1" },
  { id: "my-eyes", label: "My Eyes", built: true, phase: "C3–C4" },
  { id: "appointments", label: "Appointments", built: false, phase: "C5" },
  { id: "records", label: "Records", built: false, phase: "C5" },
  { id: "library", label: "Library", built: false, phase: "C6" },
];

export const VISIBLE_SECTIONS = SECTIONS.filter((s) => s.built);

export function sectionFromHash(hash: string): SectionId {
  const id = hash.replace(/^#\/?/, "");
  return VISIBLE_SECTIONS.find((s) => s.id === id)?.id ?? "overview";
}
