import { EYE_LABEL, MEASUREMENT_KINDS, deviceLabel, formatDate, formatValue, type Measurement, type MeasurementKind } from "../../domain/measurement";
import { SourceBadge } from "../../ui/SourceBadge";

interface Props {
  measurements: Measurement[];
  kind: MeasurementKind;
  onDelete?: (m: Measurement) => void;
  onEdit?: (m: Measurement) => void;
}

/** The table is always one tap away from the chart (NHS service manual guidance; design-spec 5.3). */
export function MeasurementTable({ measurements, kind, onDelete, onEdit }: Props) {
  const spec = MEASUREMENT_KINDS[kind];
  const rowName = (m: Measurement) => `${spec.label} ${formatValue(m)}, ${formatDate(m.date)}, ${EYE_LABEL[m.eye]}`;
  if (measurements.length === 0) return <p className="empty-state">No {spec.label} measurements recorded for this selection.</p>;
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={`${spec.label} measurements table`}>
      <table className="data-table">
        <caption className="visually-hidden">{spec.longLabel} measurements, newest first</caption>
        <thead>
          <tr>
            <th scope="col">Date taken</th>
            <th scope="col">Eye</th>
            <th scope="col" className="num">{spec.label} ({spec.unit})</th>
            <th scope="col">Device</th>
            <th scope="col">Source</th>
            {(onDelete || onEdit) && <th scope="col"><span className="visually-hidden">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {[...measurements].reverse().map((m) => (
            <tr key={m.id}>
              <td>{formatDate(m.date)}</td>
              <td>{EYE_LABEL[m.eye]}</td>
              <td className="num">{formatValue(m).replace(` ${m.unit}`, "")}</td>
              <td className={m.device ? "" : "muted"}>{deviceLabel(m.device)}</td>
              <td><SourceBadge source={m.source} />{m.note && <div className="note">Note: {m.note}</div>}</td>
              {(onDelete || onEdit) && (
                <td className="row-actions">
                  {/* aria-label gives each button a unique, explicit name for screen readers
                      ("Edit Kmax 48.2 D, 3 Mar 2026, Right eye (OD)"). It starts with the
                      visible word, so speech-control users can say "click Edit" (WCAG 2.5.3). */}
                  {onEdit && (
                    <button type="button" className="btn btn-quiet" onClick={() => onEdit(m)} aria-label={`Edit ${rowName(m)}`}>Edit</button>
                  )}
                  {onDelete && (
                    <button type="button" className="btn btn-quiet" onClick={() => onDelete(m)} aria-label={`Delete ${rowName(m)}`}>Delete</button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
