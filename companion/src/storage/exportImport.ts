/**
 * JSON export and import (ADR 0006).
 *
 * The export is the user's backup ("browser storage is not a backup"), so it
 * must be COMPLETE and LOSSLESS: every field of every record, including
 * provenance and the synthetic flag, wrapped in an envelope that says what
 * the file is and which schema version wrote it.
 *
 * Import is treated as untrusted input. The whole file is parsed and
 * validated before anything is written; a single bad record rejects the file,
 * and the error says which record and why. Partial imports are never made.
 */
import { z } from "zod";
import { measurementSchema, type Measurement } from "../domain/measurement";
import { ACCEPTS_REAL_DATA } from "./repository";

export const EXPORT_FORMAT = "keratotrack-companion-export";
export const EXPORT_SCHEMA_VERSION = 1;
/** Rejects absurdly large files before parsing (protects the tab). */
export const MAX_IMPORT_BYTES = 5_000_000;

const envelopeSchema = z
  .object({
    format: z.literal(EXPORT_FORMAT),
    schemaVersion: z.number().int(),
    exportedAt: z.string().datetime(),
    synthetic: z.boolean(),
    notice: z.string(),
    measurements: z.array(z.unknown()),
  })
  .strict();

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  synthetic: boolean;
  notice: string;
  measurements: Measurement[];
}

export function buildExport(measurements: Measurement[], now: Date): ExportFile {
  const synthetic = measurements.every((m) => m.synthetic);
  return {
    format: EXPORT_FORMAT,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    synthetic,
    notice: synthetic
      ? "SYNTHETIC DATA: not real patient information. Personal record export from KeratoTrack, not a clinical document."
      : "Personal record export from KeratoTrack, not a clinical document. This file is outside the app's protection: store it carefully.",
    measurements,
  };
}

/** Design-spec 8.1: synthetic exports carry _SYNTHETIC in the file name. */
export function exportFileName(file: ExportFile): string {
  const day = file.exportedAt.slice(0, 10);
  return `keratotrack-export-${day}${file.synthetic ? "_SYNTHETIC" : ""}.json`;
}

export type ImportResult =
  | { ok: true; measurements: Measurement[] }
  | { ok: false; error: string };

export function parseImport(text: string): ImportResult {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: "The file is too large to be a KeratoTrack export." };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "The file is not valid JSON. Choose a file exported from KeratoTrack." };
  }

  const env = envelopeSchema.safeParse(raw);
  if (!env.success) {
    return { ok: false, error: "The file is not a KeratoTrack export, or it has been changed." };
  }
  if (env.data.schemaVersion > EXPORT_SCHEMA_VERSION) {
    return { ok: false, error: `The file was made by a newer version of KeratoTrack (format version ${env.data.schemaVersion}). Update the app to import it.` };
  }
  if (env.data.schemaVersion < 1) {
    return { ok: false, error: "The file's format version is not recognised." };
  }
  // Future: if (env.data.schemaVersion === 1 && EXPORT_SCHEMA_VERSION === 2) migrate v1 -> v2 here.

  const measurements: Measurement[] = [];
  const seen = new Set<string>();
  for (const [i, record] of env.data.measurements.entries()) {
    const parsed = measurementSchema.safeParse(record);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      return { ok: false, error: `Record ${i + 1} is not valid (${issue.path.join(".") || "record"}: ${issue.message}). Nothing was imported.` };
    }
    if (seen.has(parsed.data.id)) {
      return { ok: false, error: `Record ${i + 1} repeats an identifier used earlier in the file. Nothing was imported.` };
    }
    seen.add(parsed.data.id);
    if (!ACCEPTS_REAL_DATA && !parsed.data.synthetic) {
      return { ok: false, error: "The file contains non-synthetic records. This version accepts synthetic (practice) data only. Nothing was imported." };
    }
    measurements.push(parsed.data);
  }
  if (env.data.synthetic !== measurements.every((m) => m.synthetic)) {
    return { ok: false, error: "The file's synthetic label does not match its records. Nothing was imported." };
  }
  return { ok: true, measurements };
}
