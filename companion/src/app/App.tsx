import { useEffect, useRef, useState } from "react";
import { MeasurementsPage } from "../features/measurements/MeasurementsPage";
import { OverviewPage } from "../features/overview/OverviewPage";
import { SyntheticBanner } from "../ui/SyntheticBanner";
import { VISIBLE_SECTIONS, sectionFromHash, type SectionId } from "./navigation";

/**
 * Hash-based routing (#/my-eyes). A router library is not needed for two
 * built pages, and hash URLs work from any static host without server
 * rewrite rules. Revisit when sections gain sub-pages.
 */
export function App() {
  const [section, setSection] = useState<SectionId>(() => sectionFromHash(location.hash));
  const firstRender = useRef(true);

  useEffect(() => {
    const onHash = () => setSection(sectionFromHash(location.hash));
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const label = VISIBLE_SECTIONS.find((s) => s.id === section)?.label ?? "";
    document.title = `${label} · KeratoTrack (synthetic data)`;
    // On navigation (not first load), move focus to <main> so screen-reader
    // users hear the new page instead of staying on the nav link.
    if (firstRender.current) firstRender.current = false;
    else document.getElementById("main")?.focus();
  }, [section]);

  const navigate = (hash: string) => { location.hash = hash; };

  return (
    <div className="app">
      <a href="#main" className="skip-link" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to main content</a>
      <SyntheticBanner />
      <div className="shell">
        <nav className="nav" aria-label="Main">
          <div className="wordmark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22"><ellipse cx="12" cy="12" rx="10" ry="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
            <span>KeratoTrack</span>
          </div>
          <ul>
            {VISIBLE_SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#/${s.id}`} aria-current={s.id === section ? "page" : undefined}>{s.label}</a>
              </li>
            ))}
          </ul>
          <p className="nav-footnote">Educational project. Not a medical device.</p>
        </nav>
        <main id="main" tabIndex={-1}>
          {section === "overview" && <OverviewPage onNavigate={navigate} />}
          {section === "my-eyes" && <MeasurementsPage />}
        </main>
      </div>
    </div>
  );
}
