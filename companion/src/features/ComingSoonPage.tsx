import type { Section } from "../app/navigation";

/**
 * Shown for a section that is not built yet. It describes what the section
 * will contain and offers nothing interactive, so no one mistakes it for a
 * working feature.
 */
export function ComingSoonPage({ section }: { section: Section }) {
  return (
    <section aria-labelledby="coming-soon-title">
      <p className="eyebrow">{section.label}</p>
      <h1 id="coming-soon-title">{section.label} is not built yet</h1>
      <div className="panel">
        <p>{section.summary}</p>
        <p className="muted">Planned for roadmap phase {section.phase}.</p>
      </div>
    </section>
  );
}
