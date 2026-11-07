/**
 * Turning stored measurements into what a chart may draw.
 *
 * Device rule (design-spec 5.3): thin connectors join CONSECUTIVE values
 * from the SAME named device only. A change of device breaks the line,
 * because values from different instruments may not be directly comparable.
 * A value with "Device not recorded" is never joined to anything, since we
 * cannot know it came from the same device as its neighbours.
 *
 * Missing values are simply absent: no zeros, no interpolation. A gap in
 * dates is shown as a gap on a real-time x-axis.
 */
import { deviceLabel, type Eye, type Measurement } from "../domain/measurement";
import { byDateThenCreated } from "../storage/repository";

export interface Segment {
  eye: Eye;
  device: string;
  points: Measurement[]; // length >= 2
}

export interface DeviceChange {
  eye: Eye;
  before: Measurement;
  after: Measurement;
}

export function segmentByDevice(measurements: Measurement[]): { segments: Segment[]; changes: DeviceChange[] } {
  const segments: Segment[] = [];
  const changes: DeviceChange[] = [];
  const byEye = new Map<Eye, Measurement[]>();
  for (const m of measurements) byEye.set(m.eye, [...(byEye.get(m.eye) ?? []), m]);

  for (const [eye, list] of byEye) {
    const sorted = [...list].sort(byDateThenCreated);
    let run: Measurement[] = [];
    const flush = () => {
      if (run.length >= 2) segments.push({ eye, device: run[0]!.device!, points: run });
      run = [];
    };
    for (const [i, m] of sorted.entries()) {
      const prev = sorted[i - 1];
      if (prev && prev.device !== m.device) changes.push({ eye, before: prev, after: m });
      if (m.device === null) {
        flush();
        continue;
      }
      if (run.length > 0 && run[0]!.device !== m.device) flush();
      run.push(m);
    }
    flush();
  }
  return { segments, changes };
}

export const MARKER_SHAPES = ["circle", "square", "triangle", "diamond", "wye", "cross"] as const;
export type MarkerShape = (typeof MARKER_SHAPES)[number] | "ring";

/**
 * One marker shape per device, in order of first appearance, so the legend
 * is stable. "Device not recorded" always gets a hollow ring, which reads as
 * "unknown" without needing colour (WCAG 1.4.1).
 */
export function assignDeviceMarkers(measurements: Measurement[]): Map<string | null, MarkerShape> {
  const map = new Map<string | null, MarkerShape>();
  let i = 0;
  for (const m of [...measurements].sort(byDateThenCreated)) {
    if (map.has(m.device)) continue;
    map.set(m.device, m.device === null ? "ring" : MARKER_SHAPES[i++ % MARKER_SHAPES.length]!);
  }
  return map;
}

/** The factual summary line, e.g. "Showing 4 measurements from 2 devices. 1 entry has no device recorded." */
export function summaryText(measurements: Measurement[]): string {
  if (measurements.length === 0) return "No measurements recorded for this selection.";
  if (measurements.length === 1) {
    return `One measurement recorded (${deviceLabel(measurements[0]!.device)}).`;
  }
  const named = new Set(measurements.filter((m) => m.device !== null).map((m) => m.device));
  const unknown = measurements.filter((m) => m.device === null).length;
  let s = `Showing ${measurements.length} measurements`;
  if (named.size > 0) s += ` from ${named.size} device${named.size === 1 ? "" : "s"}`;
  s += ".";
  if (unknown > 0) s += ` ${unknown} ${unknown === 1 ? "entry has" : "entries have"} no device recorded.`;
  return s;
}
