import { useEffect, useState, type ChangeEvent } from "react";
import { useStore } from "../../app/RepositoryContext";
import { EYE_LABEL, MEASUREMENT_KINDS, deviceLabel, formatDate, formatValue, type Measurement } from "../../domain/measurement";
import { buildExport, exportFileName, parseImport } from "../../storage/exportImport";
import { generateSyntheticMeasurements } from "../../synthetic/generator";
import { SourceBadge } from "../../ui/SourceBadge";

const DELETE_PHRASE = "delete all";

export function OverviewPage({ onNavigate }: { onNavigate: (hash: string) => void }) {
  const { measurements, loading, mutate } = useStore();
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [demoStatus, setDemoStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pendingImport, setPendingImport] = useState<Measurement[] | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  // Newest first by measurement date. Facts only: no arrows, no change values (design-spec 5.2).
  const recent = [...measurements].reverse().slice(0, 5);

  async function loadDemo() {
    const demo = generateSyntheticMeasurements();
    const existing = new Set(measurements.map((m) => m.id));
    const err = await mutate(async (r) => { for (const m of demo) if (!existing.has(m.id)) await r.put(m); });
    setDemoStatus(err ? { kind: "error", text: err } : { kind: "ok", text: `Loaded ${demo.length} synthetic demonstration measurements.` });
  }

  function exportJson() {
    const file = buildExport(measurements, new Date());
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName(file);
    a.click();
    URL.revokeObjectURL(url);
    setStatus({ kind: "ok", text: `Exported ${measurements.length} records to ${a.download}.` });
  }

  async function chooseImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const result = parseImport(await file.text());
    if (!result.ok) return setStatus({ kind: "error", text: result.error });
    setStatus(null);
    setPendingImport(result.measurements);
  }

  async function confirmImport() {
    if (!pendingImport) return;
    const err = await mutate((r) => r.replaceAll(pendingImport));
    setStatus(err ? { kind: "error", text: `Nothing was imported: ${err}` } : { kind: "ok", text: `Imported ${pendingImport.length} records.` });
    setPendingImport(null);
  }

  async function deleteAll() {
    const err = await mutate((r) => r.clear());
    setConfirmText("");
    setStatus(err ? { kind: "error", text: err } : { kind: "ok", text: "All records were deleted." });
  }

  async function requestPersist() {
    const granted = await navigator.storage?.persist?.().catch(() => false);
    setPersisted(!!granted);
  }

  return (
    <section aria-labelledby="overview-title">
      <p className="eyebrow">Overview</p>
      <h1 id="overview-title">Your eye-health records</h1>

      <div className="panel intro">
        <h2>What KeratoTrack does</h2>
        <ul className="ticks">
          <li>Keeps the measurements you enter, with their date, eye, device and source.</li>
          <li>Shows them as charts and tables, so you can bring them to appointments.</li>
          <li>Stores everything in this browser only. Nothing is sent anywhere.</li>
        </ul>
        <h2>What it does not do</h2>
        <ul className="crosses">
          <li>It does not diagnose, assess or interpret your eyes or your measurements.</li>
          <li>It does not recommend treatments.</li>
          <li>It is an educational project, not a medical device. Questions about your eyes belong with your eye-care professional.</li>
        </ul>
      </div>

      <div className="section-head">
        <h2>Recent entries</h2>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={() => onNavigate("#/my-eyes")}>View measurements</button>
          <button type="button" className="btn btn-secondary" onClick={loadDemo}>Load demonstration data</button>
        </div>
      </div>
      <p className={demoStatus?.kind === "error" ? "inline-error" : "status-ok"} role="status">{demoStatus?.text}</p>
      {loading ? <p className="muted">Loading…</p> : recent.length === 0 ? (
        <div className="panel empty-state">
          <p>No measurements recorded yet.</p>
          <p className="muted">Load the synthetic demonstration data to explore, or add practice values in My Eyes.</p>
        </div>
      ) : (
        <ul className="entry-list">
          {recent.map((m) => (
            <li key={m.id} className="panel entry">
              <div className="entry-main">
                <span className="entry-label">{MEASUREMENT_KINDS[m.kind].label} · {EYE_LABEL[m.eye]}</span>
                <span className="key-value num">{formatValue(m)}</span>
              </div>
              <div className="entry-meta">
                <span>{formatDate(m.date)}</span>
                <span>{deviceLabel(m.device)}</span>
                <SourceBadge source={m.source} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="panel">
        <h2>Protect your records</h2>
        <p><strong>Browser storage is not a backup.</strong> Records kept in a browser can be lost if browser data is cleared, the browser frees up space, or the device is lost. Export a copy regularly.</p>
        {persisted !== null && (
          <p className="muted">
            {persisted ? "This browser has agreed to keep this site's data unless you clear it." : "This browser may remove this site's data to free up space."}{" "}
            {!persisted && <button type="button" className="btn btn-link" onClick={requestPersist}>Ask the browser to keep it</button>}
          </p>
        )}

        <div className="data-actions">
          <div>
            <h3>Export</h3>
            <p className="hint">A complete JSON copy of every record. Once downloaded, the file is outside the app's protection: store it carefully.</p>
            <button type="button" className="btn btn-secondary" onClick={exportJson} disabled={measurements.length === 0}>Export as JSON</button>
          </div>
          <div>
            <h3>Import</h3>
            <p className="hint">Restores a KeratoTrack JSON export. The file is checked first; if any record is invalid, nothing is imported.</p>
            <label className="btn btn-secondary file-button">
              Choose file…
              <input type="file" accept="application/json,.json" onChange={chooseImport} className="visually-hidden" />
            </label>
          </div>
        </div>

        {pendingImport && (
          <div className="confirm" role="alertdialog" aria-labelledby="import-confirm-title">
            <h3 id="import-confirm-title">Replace your records?</h3>
            <p>The file contains {pendingImport.length} valid records. Importing replaces the {measurements.length} records currently stored.</p>
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={confirmImport}>Replace with imported records</button>
              <button type="button" className="btn btn-secondary" onClick={() => setPendingImport(null)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="danger-zone">
          <h3>Delete all records</h3>
          <p className="hint">Permanently deletes every record in this browser. This cannot be undone. Type <strong>{DELETE_PHRASE}</strong> to confirm.</p>
          <div className="inline-form">
            <label htmlFor="delete-confirm" className="visually-hidden">Type {DELETE_PHRASE} to confirm</label>
            <input id="delete-confirm" type="text" autoComplete="off" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            <button type="button" className="btn btn-danger" disabled={confirmText.trim().toLowerCase() !== DELETE_PHRASE || measurements.length === 0} onClick={deleteAll}>
              Delete all records
            </button>
          </div>
        </div>

        <p className={status?.kind === "error" ? "inline-error" : "status-ok"} role="status">{status?.text}</p>
      </div>
    </section>
  );
}
