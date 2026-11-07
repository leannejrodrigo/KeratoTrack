import { SOURCE_LABEL, type Source } from "../domain/measurement";

/** Icon + text, never colour alone (WCAG 1.4.1). Icons are decorative. */
const ICON: Record<Source, string> = {
  clinicReport: "M4 2h6l4 4v10H4z M10 2v4h4",
  enteredByUser: "M3 15l1-4 8-8 3 3-8 8z",
  syntheticDemo: "M9 2l2 5 5 .5-4 3.5 1.5 5L9 13l-4.5 3 1.5-5-4-3.5L7 7z",
};

export function SourceBadge({ source }: { source: Source }) {
  return (
    <span className={`badge badge-${source}`}>
      <svg viewBox="0 0 18 18" width="14" height="14" aria-hidden="true" focusable="false">
        <path d={ICON[source]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      {SOURCE_LABEL[source]}
    </span>
  );
}
