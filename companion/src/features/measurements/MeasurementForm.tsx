/**
 * Add-a-measurement form.
 *
 * Accessibility notes:
 * - Radio groups use <fieldset>/<legend>, so screen readers announce the
 *   question with each option.
 * - Each field's inline error is linked with aria-describedby and the field
 *   gets aria-invalid; the ErrorSummary links to the same ids.
 * - Device and source are pre-filled from the last entry (WCAG 3.3.7,
 *   "redundant entry"), but eye and value never are: those are the fields
 *   where a silent default would most easily produce a wrong record.
 * - Validation runs on submit only, not on every keystroke, so people are
 *   not told they are wrong while still typing (GOV.UK guidance).
 */
import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { EMPTY_DRAFT, FIELD_ORDER, validateDraft, type DraftErrors, type DraftField, type MeasurementDraft, type ValidEntry } from "../../domain/entryValidation";
import { EYES, EYE_LABEL, MEASUREMENT_KINDS, MEASUREMENT_KIND_IDS, SOURCE_LABEL, type Source } from "../../domain/measurement";
import { ErrorSummary } from "../../ui/ErrorSummary";

/** In the MVP everything typed is practice data, so "synthetic demo" is not offered as a user choice. */
const USER_SOURCES: Source[] = ["clinicReport", "enteredByUser"];

interface Props {
  todayIso: string;
  initial?: Partial<MeasurementDraft>;
  onSave: (entry: ValidEntry) => Promise<string | null>;
  onCancel: () => void;
}

export function MeasurementForm({ todayIso, initial, onSave, onCancel }: Props) {
  const uid = useId();
  const fid = (f: DraftField) => `${uid}-${f}`;
  const [draft, setDraft] = useState<MeasurementDraft>({ ...EMPTY_DRAFT, ...initial });
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof MeasurementDraft>(k: K, v: MeasurementDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = validateDraft(draft, todayIso);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    const err = await onSave(result.entry);
    setSaving(false);
    setSaveError(err);
  }

  // Memoised on `errors`: ErrorSummary moves focus whenever its list changes,
  // so a new array on every keystroke would steal focus from the field being
  // typed in. It must change only when a submit produces new errors.
  const summary = useMemo(
    () =>
      FIELD_ORDER.filter((f) => errors[f]).map((f) => ({
        // Radio groups: link to the first option, which is focusable.
        fieldId: f === "kind" || f === "eye" || f === "deviceChoice" || f === "source" ? `${uid}-${f}-0` : `${uid}-${f}`,
        message: errors[f]!,
      })),
    [errors, uid],
  );

  const kindSpec = draft.kind ? MEASUREMENT_KINDS[draft.kind] : null;

  return (
    <form className="panel form" onSubmit={submit} noValidate aria-labelledby={`${uid}-title`}>
      <h2 id={`${uid}-title`}>Add a practice measurement</h2>
      <p className="hint">This version stores synthetic practice data only. Use invented values, not your real measurements.</p>
      <ErrorSummary errors={summary} />

      <RadioGroup legend="Which measurement is this?" name="kind" error={errors.kind} idBase={fid("kind")}
        options={MEASUREMENT_KIND_IDS.map((k) => ({ value: k, label: `${MEASUREMENT_KINDS[k].longLabel}, in ${MEASUREMENT_KINDS[k].unitLabel}` }))}
        value={draft.kind} onChange={(v) => set("kind", v as MeasurementDraft["kind"])} />

      <RadioGroup legend="Which eye?" name="eye" error={errors.eye} idBase={fid("eye")} inline
        options={EYES.map((e) => ({ value: e, label: EYE_LABEL[e] }))}
        value={draft.eye} onChange={(v) => set("eye", v as MeasurementDraft["eye"])} />

      <Field id={fid("date")} label="Date the measurement was taken" hint="Not the date you are entering it. For example, 3 March 2026." error={errors.date}>
        <input id={fid("date")} type="date" max={todayIso} value={draft.date} onChange={(e) => set("date", e.target.value)}
          aria-invalid={!!errors.date} aria-describedby={`${fid("date")}-hint${errors.date ? ` ${fid("date")}-error` : ""}`} />
      </Field>

      <Field id={fid("value")} label={kindSpec ? `Value (${kindSpec.unitLabel})` : "Value"} hint={kindSpec ? `Recorded to ${kindSpec.resolution === 1 ? "whole numbers" : `${kindSpec.resolution} ${kindSpec.unit}`}.` : "Choose the measurement first to see its unit."} error={errors.value}>
        <div className="input-with-suffix">
          <input id={fid("value")} type="text" inputMode="decimal" autoComplete="off" spellCheck={false} className="input-narrow num"
            value={draft.value} onChange={(e) => set("value", e.target.value)}
            aria-invalid={!!errors.value} aria-describedby={`${fid("value")}-hint${errors.value ? ` ${fid("value")}-error` : ""}`} />
          {kindSpec && <span className="suffix" aria-hidden="true">{kindSpec.unit}</span>}
        </div>
      </Field>

      <RadioGroup legend="Do you know which device took this measurement?" name="deviceChoice" error={errors.deviceChoice} idBase={fid("deviceChoice")}
        hint="Values from different devices may not be directly comparable, so the device is always recorded."
        options={[{ value: "named", label: "Yes, I know the device" }, { value: "notRecorded", label: "Device not recorded" }]}
        value={draft.deviceChoice} onChange={(v) => set("deviceChoice", v as MeasurementDraft["deviceChoice"])} />

      {draft.deviceChoice === "named" && (
        <Field id={fid("deviceName")} label="Device name" hint="As written on the report." error={errors.deviceName}>
          <input id={fid("deviceName")} type="text" autoComplete="off" value={draft.deviceName} onChange={(e) => set("deviceName", e.target.value)}
            aria-invalid={!!errors.deviceName} aria-describedby={`${fid("deviceName")}-hint${errors.deviceName ? ` ${fid("deviceName")}-error` : ""}`} />
        </Field>
      )}

      <RadioGroup legend="Where did this value come from?" name="source" error={errors.source} idBase={fid("source")}
        options={USER_SOURCES.map((s) => ({ value: s, label: SOURCE_LABEL[s] }))}
        value={draft.source} onChange={(v) => set("source", v as Source)} />

      <Field id={fid("note")} label="Note (optional)" hint="For example, who wrote it on the report." error={errors.note}>
        <textarea id={fid("note")} rows={2} value={draft.note} onChange={(e) => set("note", e.target.value)}
          aria-invalid={!!errors.note} aria-describedby={`${fid("note")}-hint${errors.note ? ` ${fid("note")}-error` : ""}`} />
      </Field>

      {saveError && <p className="inline-error" role="alert">The measurement could not be saved: {saveError}</p>}
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>Save measurement</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className={`field${error ? " field-error" : ""}`}>
      <label htmlFor={id} className="label">{label}</label>
      {hint && <p id={`${id}-hint`} className="hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="inline-error"><span className="visually-hidden">Error: </span>{error}</p>}
      {children}
    </div>
  );
}

function RadioGroup(props: {
  legend: string; name: string; idBase: string; error?: string; hint?: string; inline?: boolean;
  options: { value: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  const { legend, name, idBase, error, hint, inline, options, value, onChange } = props;
  const describedBy = [hint ? `${idBase}-hint` : "", error ? `${idBase}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <fieldset className={`field${error ? " field-error" : ""}`} aria-describedby={describedBy}>
      <legend className="label">{legend}</legend>
      {hint && <p id={`${idBase}-hint`} className="hint">{hint}</p>}
      {error && <p id={`${idBase}-error`} className="inline-error"><span className="visually-hidden">Error: </span>{error}</p>}
      <div className={inline ? "radios radios-inline" : "radios"}>
        {options.map((o, i) => (
          <label key={o.value} className="radio">
            <input type="radio" id={`${idBase}-${i}`} name={`${idBase}-${name}`} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
