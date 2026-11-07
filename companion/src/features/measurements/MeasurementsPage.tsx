import { useEffect, useMemo, useState } from "react";
import { useStore } from "../../app/RepositoryContext";
import { MeasurementChart } from "../../charts/MeasurementChart";
import { EYE_LABEL, MEASUREMENT_KINDS, MEASUREMENT_KIND_IDS, formatDate, formatValue, type Eye, type Measurement, type MeasurementKind } from "../../domain/measurement";
import { localTodayIso } from "../../domain/today";
import { Toast, type ToastState } from "../../ui/Toast";
import { MeasurementForm } from "./MeasurementForm";
import { MeasurementTable } from "./MeasurementTable";
import { newPracticeMeasurement } from "./newMeasurement";

type EyeFilter = Eye | "both";
const EYE_FILTERS: { value: EyeFilter; label: string }[] = [
  { value: "OD", label: "Right (OD)" },
  { value: "OS", label: "Left (OS)" },
  { value: "both", label: "Both" },
];
const EYE_KEY = "keratotrack.eyeFilter";

/** Eye selection persists for the session (design-spec 7). Storage access can throw, so it is wrapped. */
function readEye(): EyeFilter {
  try {
    const v = sessionStorage.getItem(EYE_KEY);
    return v === "OD" || v === "OS" || v === "both" ? v : "both";
  } catch {
    return "both";
  }
}

export function MeasurementsPage() {
  const { measurements, loading, mutate } = useStore();
  const [eye, setEye] = useState<EyeFilter>(readEye);
  const [kind, setKind] = useState<MeasurementKind>("kmax");
  const [view, setView] = useState<"chart" | "table">("chart");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [lastEntry, setLastEntry] = useState<{ deviceChoice: "named" | "notRecorded"; deviceName: string; source: Measurement["source"] } | null>(null);

  useEffect(() => {
    try { sessionStorage.setItem(EYE_KEY, eye); } catch { /* storage unavailable: selection just won't persist */ }
  }, [eye]);

  const visible = useMemo(
    () => measurements.filter((m) => m.kind === kind && (eye === "both" || m.eye === eye) && (!from || m.date >= from) && (!to || m.date <= to)),
    [measurements, kind, eye, from, to],
  );
  const synthetic = visible.every((m) => m.synthetic);

  async function remove(m: Measurement) {
    const err = await mutate((r) => r.delete(m.id));
    if (err) return setToast({ message: `Could not delete: ${err}` });
    setToast({
      message: `Deleted ${MEASUREMENT_KINDS[m.kind].label} ${formatValue(m)}, ${formatDate(m.date)}.`,
      actionLabel: "Undo",
      // Undo re-stores the identical record (same id and createdAt).
      onAction: () => void mutate((r) => r.put(m)),
    });
  }

  if (adding) {
    return (
      <MeasurementForm
        todayIso={localTodayIso()}
        initial={lastEntry ?? undefined}
        onCancel={() => setAdding(false)}
        onSave={async (entry) => {
          const err = await mutate((r) => r.put(newPracticeMeasurement(entry)));
          if (!err) {
            setLastEntry({ deviceChoice: entry.device === null ? "notRecorded" : "named", deviceName: entry.device ?? "", source: entry.source });
            setAdding(false);
            setKind(entry.kind);
            setToast({ message: `Saved ${MEASUREMENT_KINDS[entry.kind].label} for ${EYE_LABEL[entry.eye].replace(/^\w/, (c) => c.toLowerCase())}, ${formatDate(entry.date)}.` });
          }
          return err;
        }}
      />
    );
  }

  return (
    <section aria-labelledby="measurements-title">
      <div className="page-head">
        <div>
          <p className="eyebrow">My Eyes</p>
          <h1 id="measurements-title">Measurements</h1>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>Add measurement</button>
      </div>

      <div className="controls panel">
        <fieldset className="segmented">
          <legend className="label-small">Eye</legend>
          {EYE_FILTERS.map((o) => (
            <label key={o.value} className={eye === o.value ? "seg seg-on" : "seg"}>
              <input type="radio" name="eye-filter" value={o.value} checked={eye === o.value}
                onChange={() => { setEye(o.value); setAnnouncement(`Showing ${o.value === "both" ? "both eyes" : EYE_LABEL[o.value].replace(/^\w/, (c) => c.toLowerCase())}`); }} />
              {o.label}
            </label>
          ))}
        </fieldset>
        <div className="control">
          <label htmlFor="kind-select" className="label-small">Measurement</label>
          <select id="kind-select" value={kind} onChange={(e) => setKind(e.target.value as MeasurementKind)}>
            {MEASUREMENT_KIND_IDS.map((k) => <option key={k} value={k}>{MEASUREMENT_KINDS[k].label} ({MEASUREMENT_KINDS[k].unit})</option>)}
          </select>
        </div>
        <div className="control">
          <label htmlFor="from-date" className="label-small">From</label>
          <input id="from-date" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="control">
          <label htmlFor="to-date" className="label-small">To</label>
          <input id="to-date" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </div>
        {(from || to) && <button type="button" className="btn btn-quiet" onClick={() => { setFrom(""); setTo(""); }}>Clear dates</button>}
      </div>
      <p className="visually-hidden" aria-live="polite">{announcement}</p>

      <div className="view-tabs" role="group" aria-label="View">
        <button type="button" aria-pressed={view === "chart"} className={view === "chart" ? "tab tab-on" : "tab"} onClick={() => setView("chart")}>Chart</button>
        <button type="button" aria-pressed={view === "table"} className={view === "table" ? "tab tab-on" : "tab"} onClick={() => setView("table")}>Table</button>
      </div>

      <div className="panel">
        {loading ? <p className="muted">Loading…</p> : view === "chart"
          ? <MeasurementChart measurements={visible} kind={kind} synthetic={synthetic} />
          : <MeasurementTable measurements={visible} kind={kind} onDelete={remove} />}
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </section>
  );
}
