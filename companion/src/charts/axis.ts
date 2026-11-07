/**
 * Transparent, data-dependent y-axis (design-spec 5.3).
 *
 *   1. Bounds start at the lowest and highest values in view.
 *   2. padding = max(10% of the data range, 10 × reporting resolution).
 *      The second term matters when values are close together or there is
 *      only one value: range would be ~0, and a zero-height axis would make
 *      tiny differences look enormous. 10 × resolution (1.0 D for Kmax at
 *      0.1 D) is a DISPLAY constant, not a clinical number.
 *   3. Bounds are extended outwards to "nice" tick values. D3's .nice() only
 *      ever widens the domain, so values are never clipped.
 *   4. A "Both eyes" view passes both eyes' values, giving one shared axis.
 *
 * No clinical thresholds, reference ranges or zero-based baselines: the
 * caption tells users the axis does not start at zero.
 */
import { scaleLinear } from "d3-scale";

export const PADDING_FRACTION = 0.1;
export const RESOLUTION_MULTIPLIER = 10;

export interface YAxis {
  domain: [number, number];
  ticks: number[];
}

export function computeYAxis(values: number[], resolution: number, tickCount = 5): YAxis | null {
  if (values.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (!Number.isFinite(v)) throw new Error("computeYAxis: values must be finite");
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const padding = Math.max(PADDING_FRACTION * (max - min), RESOLUTION_MULTIPLIER * resolution);
  const scale = scaleLinear().domain([min - padding, max + padding]).nice(tickCount);
  const [lo, hi] = scale.domain() as [number, number];
  return { domain: [lo, hi], ticks: scale.ticks(tickCount) };
}
