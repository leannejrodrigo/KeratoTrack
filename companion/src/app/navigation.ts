/**
 * Companion navigation (design-spec 5.1). Exactly five sections, in this
 * order; a test enforces both. All five are shown from the start. A section
 * that is not built yet opens a short "coming soon" page that says what it
 * will contain, with no placeholder features (decision 2026-11-08).
 */
export type SectionId = "overview" | "my-eyes" | "appointments" | "records" | "library";

export interface Section {
  id: SectionId;
  label: string;
  built: boolean;
  /** Roadmap phase that builds it. */
  phase: string;
  /** What the section will contain, shown on its coming-soon page. */
  summary: string;
}

export const SECTIONS: readonly Section[] = [
  { id: "overview", label: "Overview", built: true, phase: "C1", summary: "Recent entries, what the app does and does not do, and backups." },
  { id: "my-eyes", label: "My Eyes", built: true, phase: "C3–C4", summary: "Your measurements for each eye, as charts and tables." },
  {
    id: "appointments",
    label: "Appointments",
    built: false,
    phase: "C5",
    summary: "Upcoming and past appointments, and a personal list of questions you write yourself to bring to them.",
  },
  {
    id: "records",
    label: "Records",
    built: false,
    phase: "C5",
    summary: "Treatments you have had, with dates and sources, and printable reports of your recorded data.",
  },
  {
    id: "library",
    label: "Library",
    built: false,
    phase: "C6",
    summary: "Plain-language articles and a glossary of keratoconus terms, with sources and review dates.",
  },
];

export function sectionFromHash(hash: string): SectionId {
  const id = hash.replace(/^#\/?/, "");
  return SECTIONS.find((s) => s.id === id)?.id ?? "overview";
}
