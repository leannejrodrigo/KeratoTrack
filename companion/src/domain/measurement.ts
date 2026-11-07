/**
 * Measurement domain model.
 *
 * The runtime schema (zod) is the source of truth and the TypeScript type is
 * *derived* from it with z.infer. That matters because TypeScript types vanish
 * when compiled: anything arriving from outside the program (an imported JSON
 * file, a record read back from IndexedDB written by an older version) is
 * unchecked `unknown` until the schema parses it. One definition gives us both
 * the compile-time type and the runtime check, so they can never drift apart.
 *
 * Safety rule 5 (docs/safety-boundaries.md) is enforced here: date, eye,
 * device and source are required fields, not optional extras added by the UI.
 */
import { z } from "zod";

export const EYES = ["OD", "OS"] as const;
export type Eye = (typeof EYES)[number];

export const EYE_LABEL: Record<Eye, string> = {
  OD: "Right eye (OD)",
  OS: "Left eye (OS)",
};

/**
 * Measurement kinds. Each kind fixes its unit and the reporting resolution
 * (the smallest step the value is recorded in). Resolution feeds the chart
 * axis rule (design-spec 5.3). Units are fixed per kind, so a value cannot
 * silently be stored in the wrong unit.
 *
 * `entryLimits` are DATA-ENTRY checks only. They catch values that cannot be
 * a correctly typed entry for this field (the spec's example: a Kmax of
 * 5.7 D, probably a missing digit). They are deliberately very wide and are
 * NOT clinical ranges; the app never uses them to judge a value, and they are
 * never drawn on charts (safety rule 3).
 */
export const MEASUREMENT_KINDS = {
  kmax: {
    label: "Kmax",
    longLabel: "Maximum keratometry (Kmax)",
    unit: "D",
    unitLabel: "dioptres (D)",
    resolution: 0.1,
    entryLimits: { min: 20, max: 120 },
  },
  thinnestThickness: {
    label: "Thinnest corneal thickness",
    longLabel: "Thinnest corneal thickness",
    unit: "µm",
    unitLabel: "micrometres (µm)",
    resolution: 1,
    entryLimits: { min: 100, max: 1000 },
  },
} as const;

export type MeasurementKind = keyof typeof MEASUREMENT_KINDS;
export const MEASUREMENT_KIND_IDS = Object.keys(MEASUREMENT_KINDS) as MeasurementKind[];

export const SOURCES = ["clinicReport", "enteredByUser", "syntheticDemo"] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABEL: Record<Source, string> = {
  clinicReport: "From clinic report (entered by you)",
  enteredByUser: "Entered by you",
  syntheticDemo: "Synthetic demonstration data",
};

/** Calendar date only (no time, no time zone): "2026-03-03". */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine((s) => isRealCalendarDate(s), "Not a real calendar date");

export function isRealCalendarDate(s: string): boolean {
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  // Date.UTC rolls 2026-02-30 over to 2 March, so a round-trip exposes it.
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export const measurementSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(MEASUREMENT_KIND_IDS as [MeasurementKind, ...MeasurementKind[]]),
    eye: z.enum(EYES),
    /** When the measurement was TAKEN, not when it was entered. */
    date: isoDateSchema,
    value: z.number().finite(),
    unit: z.enum(["D", "µm"]),
    /**
     * Instrument name, or null meaning the user explicitly chose "Device not
     * recorded". The key itself is required: `undefined` (forgot to ask) is
     * rejected, `null` (asked, unknown) is accepted.
     */
    device: z.string().trim().min(1).max(80).nullable(),
    source: z.enum(SOURCES),
    note: z.string().max(500).optional(),
    /** Immutable once created; see design-spec 8.1. */
    synthetic: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((m, ctx) => {
    if (m.unit !== MEASUREMENT_KINDS[m.kind].unit) {
      ctx.addIssue({ code: "custom", path: ["unit"], message: `${MEASUREMENT_KINDS[m.kind].label} is recorded in ${MEASUREMENT_KINDS[m.kind].unit}` });
    }
    if (m.synthetic !== m.id.startsWith("SYN-")) {
      ctx.addIssue({ code: "custom", path: ["id"], message: "Synthetic records must have SYN- identifiers, and only synthetic records may" });
    }
    if (m.source === "syntheticDemo" && !m.synthetic) {
      ctx.addIssue({ code: "custom", path: ["source"], message: "Synthetic demonstration source requires synthetic: true" });
    }
  });

export type Measurement = z.infer<typeof measurementSchema>;

export function deviceLabel(device: string | null): string {
  return device ?? "Device not recorded";
}

export function formatValue(m: Pick<Measurement, "kind" | "value">): string {
  const spec = MEASUREMENT_KINDS[m.kind];
  const decimals = Math.max(0, -Math.floor(Math.log10(spec.resolution)));
  return `${m.value.toFixed(decimals)} ${spec.unit}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Unambiguous date ("3 Mar 2026"), never 03/04/2026 (design-spec 5.3). */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Full provenance sentence, as in the safety-boundaries "allowed" example. */
export function provenanceText(m: Measurement): string {
  const kind = MEASUREMENT_KINDS[m.kind];
  const eye = EYE_LABEL[m.eye].replace(/^\w/, (c) => c.toLowerCase()); // "right eye (OD)"
  return `${kind.label}, ${eye}: ${formatValue(m)}, ${formatDate(m.date)}, ${deviceLabel(m.device)}, ${SOURCE_LABEL[m.source].toLowerCase()}`;
}
