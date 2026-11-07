/**
 * Measurement chart: React renders every SVG element; D3 supplies maths only
 * (scales, line paths, marker symbol paths). ADR 0003.
 *
 * Encodings (WCAG 1.4.1: never colour alone):
 *   eye     -> colour AND connector style (OD solid teal, OS dashed navy) AND
 *              a direct text label at the end of each eye's data
 *   device  -> marker SHAPE (legend below); "Device not recorded" is a ring
 *
 * Keyboard: every point is focusable (Tab), and Left/Right arrows move
 * between points in date order. Focusing, hovering or tapping a point shows
 * its full provenance in the panel under the chart (a polite live region).
 */
import { scaleLinear, scaleUtc } from "d3-scale";
import { line, symbol, symbolCircle, symbolCross, symbolDiamond, symbolSquare, symbolTriangle, symbolWye, type SymbolType } from "d3-shape";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { EYE_LABEL, MEASUREMENT_KINDS, deviceLabel, formatDate, provenanceText, type Eye, type Measurement, type MeasurementKind } from "../domain/measurement";
import { byDateThenCreated } from "../storage/repository";
import { computeYAxis } from "./axis";
import { assignDeviceMarkers, segmentByDevice, summaryText, type MarkerShape } from "./series";

const SYMBOLS: Record<Exclude<MarkerShape, "ring">, SymbolType> = {
  circle: symbolCircle, square: symbolSquare, triangle: symbolTriangle,
  diamond: symbolDiamond, wye: symbolWye, cross: symbolCross,
};
const EYE_STYLE: Record<Eye, { color: string; dash?: string }> = {
  OD: { color: "var(--series-eye-od)" },
  OS: { color: "var(--series-eye-os)", dash: "6 4" },
};
const MARKER_AREA = 90;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;

export const AXIS_CAPTION = "Axis range is fitted to the recorded values and does not start at zero.";
export const DEVICE_CHANGE_TEXT = "Device changed: values may not be directly comparable.";

function toUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function useElementWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => entry && setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function MarkerIcon({ shape, color = "currentColor", size = 16 }: { shape: MarkerShape; color?: string; size?: number }) {
  const d = shape === "ring" ? symbol(symbolCircle, MARKER_AREA)()! : symbol(SYMBOLS[shape], MARKER_AREA)()!;
  return (
    <svg width={size} height={size} viewBox="-8 -8 16 16" aria-hidden="true" focusable="false">
      <path d={d} fill={shape === "ring" ? "var(--surface)" : color} stroke={color} strokeWidth={shape === "ring" ? 2 : 1} />
    </svg>
  );
}

interface Props {
  measurements: Measurement[];
  kind: MeasurementKind;
  synthetic: boolean;
}

export function MeasurementChart({ measurements, kind, synthetic }: Props) {
  const spec = MEASUREMENT_KINDS[kind];
  const titleId = useId();
  const [containerRef, width] = useElementWidth<HTMLDivElement>(720);
  const [activeId, setActiveId] = useState<string | null>(null);
  const pointRefs = useRef(new Map<string, SVGGElement>());

  const sorted = useMemo(() => [...measurements].sort(byDateThenCreated), [measurements]);
  const yAxis = useMemo(() => computeYAxis(sorted.map((m) => m.value), spec.resolution), [sorted, spec.resolution]);
  const { segments, changes } = useMemo(() => segmentByDevice(sorted), [sorted]);
  const markers = useMemo(() => assignDeviceMarkers(sorted), [sorted]);
  const eyes = useMemo(() => [...new Set(sorted.map((m) => m.eye))].sort() as Eye[], [sorted]);

  if (!yAxis || sorted.length === 0) {
    return <p className="empty-state">No {spec.label} measurements recorded for this selection.</p>;
  }

  const height = Math.min(380, Math.max(260, width * 0.5));
  const margin = { top: synthetic ? 36 : 20, right: eyes.length > 1 ? 44 : 20, bottom: 40, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  // Real-time x-axis. Pad by 4% of the span (or 60 days for a single date)
  // so edge points are not drawn on the frame.
  const t0 = toUtc(sorted[0]!.date).getTime();
  const t1 = toUtc(sorted[sorted.length - 1]!.date).getTime();
  const xPad = Math.max((t1 - t0) * 0.04, 60 * DAY_MS);
  const x = scaleUtc().domain([new Date(t0 - xPad), new Date(t1 + xPad)]).range([0, innerW]);
  const y = scaleLinear().domain(yAxis.domain).range([innerH, 0]);
  const xTicks = x.ticks(Math.max(2, Math.floor(innerW / 110)));
  const decimals = Math.max(0, -Math.floor(Math.log10(spec.resolution)));
  const yTickDecimals = yAxis.ticks.some((t) => !Number.isInteger(t)) ? Math.max(1, decimals) : 0;

  const linePath = line<Measurement>().x((m) => x(toUtc(m.date))).y((m) => y(m.value));

  // One dashed marker per distinct device-change position (both eyes may change on the same day).
  const changeXs = [...new Set(changes.map((c) => (x(toUtc(c.before.date)) + x(toUtc(c.after.date))) / 2))].sort((a, b) => a - b);
  // Label a change line only if it is far enough from the last labelled one;
  // the caption below explains every dashed line, so no information is lost.
  let lastLabelled = -Infinity;
  const labelled = new Set(changeXs.filter((cx) => (cx - lastLabelled >= 110 ? ((lastLabelled = cx), true) : false)));
  const active = sorted.find((m) => m.id === activeId) ?? null;

  const focusIndex = (i: number) => {
    const target = sorted[Math.max(0, Math.min(sorted.length - 1, i))]!;
    pointRefs.current.get(target.id)?.focus();
  };

  return (
    <figure className="chart" aria-labelledby={titleId}>
      <div ref={containerRef} className="chart-canvas">
        <svg width={width} height={height} role="group" aria-labelledby={titleId}>
          <title id={titleId}>{`${spec.longLabel} (${spec.unit}) over time. ${summaryText(sorted)}`}</title>
          <g transform={`translate(${margin.left},${margin.top})`}>
            {/* Gridlines and y-axis */}
            {yAxis.ticks.map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`} aria-hidden="true">
                <line x2={innerW} className="grid" />
                <text x={-10} dy="0.32em" textAnchor="end" className="tick">{t.toFixed(yTickDecimals)}</text>
              </g>
            ))}
            <text transform={`translate(${-margin.left + 14},${innerH / 2}) rotate(-90)`} textAnchor="middle" className="axis-title" aria-hidden="true">
              {spec.label} ({spec.unit})
            </text>
            {/* x-axis */}
            <line y1={innerH} y2={innerH} x2={innerW} className="axis" aria-hidden="true" />
            {xTicks.map((t) => (
              <text key={t.getTime()} x={x(t)} y={innerH + 24} textAnchor="middle" className="tick" aria-hidden="true">
                {`${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`}
              </text>
            ))}
            {/* Device changes */}
            {changeXs.map((cx) => (
              <g key={cx} aria-hidden="true">
                <line x1={cx} x2={cx} y1={0} y2={innerH} className="device-change" />
                {labelled.has(cx) && <text x={cx + 4} y={12} className="device-change-label">Device changed</text>}
              </g>
            ))}
            {/* Connectors: same eye, same named device, consecutive only */}
            {segments.map((s) => (
              <path
                key={`${s.eye}-${s.points[0]!.id}`}
                d={linePath(s.points) ?? undefined}
                fill="none"
                stroke={EYE_STYLE[s.eye].color}
                strokeWidth={1.5}
                strokeDasharray={EYE_STYLE[s.eye].dash}
                aria-hidden="true"
              />
            ))}
            {/* Direct eye labels when both eyes are shown */}
            {eyes.length > 1 && eyes.map((eye) => {
              const last = [...sorted].reverse().find((m) => m.eye === eye)!;
              return (
                <text key={eye} x={x(toUtc(last.date)) + 10} y={y(last.value)} dy="0.32em" className="eye-label" fill={EYE_STYLE[eye].color} aria-hidden="true">
                  {eye}
                </text>
              );
            })}
            {/* Points */}
            {sorted.map((m, i) => {
              const shape = markers.get(m.device)!;
              const d = shape === "ring" ? symbol(symbolCircle, MARKER_AREA)()! : symbol(SYMBOLS[shape], MARKER_AREA)()!;
              const isActive = m.id === activeId;
              return (
                <g
                  key={m.id}
                  ref={(el) => { if (el) pointRefs.current.set(m.id, el); else pointRefs.current.delete(m.id); }}
                  className="point"
                  transform={`translate(${x(toUtc(m.date))},${y(m.value)})`}
                  tabIndex={0}
                  role="img"
                  aria-label={provenanceText(m)}
                  onFocus={() => setActiveId(m.id)}
                  onMouseEnter={() => setActiveId(m.id)}
                  onClick={() => setActiveId(m.id)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); focusIndex(i + 1); }
                    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); focusIndex(i - 1); }
                    if (e.key === "Home") { e.preventDefault(); focusIndex(0); }
                    if (e.key === "End") { e.preventDefault(); focusIndex(sorted.length - 1); }
                  }}
                >
                  {/* 44px invisible hit area for touch (design-spec 2.5.5 target) */}
                  <circle r={22} fill="transparent" />
                  {isActive && <circle r={11} className="point-focus" />}
                  <path d={d} fill={shape === "ring" ? "var(--surface)" : EYE_STYLE[m.eye].color} stroke={EYE_STYLE[m.eye].color} strokeWidth={shape === "ring" ? 2 : 1} />
                </g>
              );
            })}
          </g>
          {synthetic && (
            <g transform={`translate(${width - 12},14)`} aria-hidden="true">
              <text textAnchor="end" className="chart-synthetic-label">SYNTHETIC</text>
            </g>
          )}
        </svg>
      </div>

      <div className="chart-detail" aria-live="polite">
        {active ? (
          <p>{provenanceText(active)}</p>
        ) : (
          <p className="muted">Select a point, or press Tab to move to the chart and use the arrow keys, to see its full details.</p>
        )}
      </div>

      <figcaption>
        <p className="chart-summary">{summaryText(sorted)}</p>
        <ul className="legend" aria-label="Chart key">
          {eyes.map((eye) => (
            <li key={eye}>
              <svg width="28" height="10" aria-hidden="true" focusable="false">
                <line x1="0" x2="28" y1="5" y2="5" stroke={EYE_STYLE[eye].color} strokeWidth="2" strokeDasharray={EYE_STYLE[eye].dash} />
              </svg>
              {EYE_LABEL[eye]}
            </li>
          ))}
          {[...markers].map(([device, shape]) => (
            <li key={device ?? "__none"}>
              <MarkerIcon shape={shape} color="var(--text-secondary)" />
              {deviceLabel(device)}
            </li>
          ))}
        </ul>
        {changes.length > 0 && <p className="caption">Dashed vertical line: {DEVICE_CHANGE_TEXT} Lines only join values from the same device.</p>}
        <p className="caption">{AXIS_CAPTION} {formatDate(sorted[0]!.date)} to {formatDate(sorted[sorted.length - 1]!.date)}.</p>
      </figcaption>
    </figure>
  );
}
