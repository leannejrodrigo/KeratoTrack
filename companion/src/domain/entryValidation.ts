/**
 * Validation for the "add a measurement" form.
 *
 * Wording rule (safety-boundaries, "data-entry checks"): every message is
 * about the ENTRY, never about the person's health. "Check this value: it is
 * outside what this field accepts" is allowed; "this value is abnormal" is not.
 * A test asserts that no message contains clinical words.
 *
 * Messages follow GOV.UK error-message style: say what is wrong and how to fix
 * it, in plain words. The same text is used inline and in the error summary.
 */
import { EYES, MEASUREMENT_KINDS, SOURCES, isRealCalendarDate, type Eye, type Measurement, type MeasurementKind, type Source } from "./measurement";

export interface MeasurementDraft {
  kind: MeasurementKind | "";
  eye: Eye | "";
  date: string;
  value: string;
  deviceChoice: "named" | "notRecorded" | "";
  deviceName: string;
  source: Source | "";
  note: string;
}

export type DraftField = "kind" | "eye" | "date" | "value" | "deviceChoice" | "deviceName" | "source" | "note";
export type DraftErrors = Partial<Record<DraftField, string>>;

export interface ValidEntry {
  kind: MeasurementKind;
  eye: Eye;
  date: string;
  value: number;
  device: string | null;
  source: Source;
  note?: string;
}

export const EMPTY_DRAFT: MeasurementDraft = {
  kind: "",
  eye: "",
  date: "",
  value: "",
  deviceChoice: "",
  deviceName: "",
  source: "",
  note: "",
};

/** Field order matters: the error summary lists errors in form order. */
export const FIELD_ORDER: DraftField[] = ["kind", "eye", "date", "value", "deviceChoice", "deviceName", "source", "note"];

export function validateDraft(
  draft: MeasurementDraft,
  todayIso: string,
): { ok: true; entry: ValidEntry } | { ok: false; errors: DraftErrors } {
  const errors: DraftErrors = {};

  if (!draft.kind || !(draft.kind in MEASUREMENT_KINDS)) errors.kind = "Select which measurement this is";
  if (!draft.eye || !EYES.includes(draft.eye)) errors.eye = "Select which eye this measurement is for";

  const date = draft.date.trim();
  if (!date) errors.date = "Enter the date the measurement was taken";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isRealCalendarDate(date)) errors.date = "Date must be a real date";
  // ISO dates compare correctly as strings because the fields are fixed-width
  // and ordered most-significant first.
  else if (date > todayIso) errors.date = "Date the measurement was taken must be today or in the past";
  else if (date < "1950-01-01") errors.date = "Date must be after 1 Jan 1950. Check for a typing error";

  let value = NaN;
  const rawValue = draft.value.trim().replace(",", ".");
  if (!rawValue) errors.value = "Enter the measurement value";
  else if (!/^-?\d+(\.\d+)?$/.test(rawValue)) errors.value = "Value must be a number, like 47.5";
  else {
    value = Number(rawValue);
    if (draft.kind && draft.kind in MEASUREMENT_KINDS) {
      const spec = MEASUREMENT_KINDS[draft.kind];
      const decimals = rawValue.includes(".") ? rawValue.split(".")[1]!.length : 0;
      const maxDecimals = Math.max(0, -Math.floor(Math.log10(spec.resolution)));
      if (value < spec.entryLimits.min || value > spec.entryLimits.max) {
        errors.value = `Check this value: ${spec.label} entries must be between ${spec.entryLimits.min} and ${spec.entryLimits.max} ${spec.unit}. It may be a typing error, or a value in a different unit`;
      } else if (decimals > maxDecimals) {
        errors.value = maxDecimals === 0
          ? `${spec.label} is recorded in whole ${spec.unit}. Remove the decimal places`
          : `${spec.label} is recorded to ${maxDecimals} decimal place${maxDecimals > 1 ? "s" : ""}`;
      }
    }
  }

  if (draft.deviceChoice !== "named" && draft.deviceChoice !== "notRecorded") {
    errors.deviceChoice = "Select whether you know which device took this measurement";
  } else if (draft.deviceChoice === "named") {
    const name = draft.deviceName.trim();
    if (!name) errors.deviceName = "Enter the device name, or choose ‘Device not recorded’";
    else if (name.length > 80) errors.deviceName = "Device name must be 80 characters or fewer";
  }

  if (!draft.source || !SOURCES.includes(draft.source)) errors.source = "Select where this value came from";
  if (draft.note.length > 500) errors.note = "Note must be 500 characters or fewer";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const note = draft.note.trim();
  return {
    ok: true,
    entry: {
      kind: draft.kind as MeasurementKind,
      eye: draft.eye as Eye,
      date,
      value,
      device: draft.deviceChoice === "named" ? draft.deviceName.trim() : null,
      source: draft.source as Source,
      ...(note ? { note } : {}),
    },
  };
}

/**
 * The reverse of validateDraft: fill the form from a stored record, for
 * editing. The value is written at the kind's resolution ("48.0", not "48"),
 * so saving an unedited form reproduces exactly the stored value.
 */
export function measurementToDraft(m: Measurement): MeasurementDraft {
  const decimals = Math.max(0, -Math.floor(Math.log10(MEASUREMENT_KINDS[m.kind].resolution)));
  return {
    kind: m.kind,
    eye: m.eye,
    date: m.date,
    value: m.value.toFixed(decimals),
    deviceChoice: m.device === null ? "notRecorded" : "named",
    deviceName: m.device ?? "",
    source: m.source,
    note: m.note ?? "",
  };
}
