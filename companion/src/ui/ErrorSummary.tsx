/**
 * GOV.UK error summary pattern (design-spec 8):
 * shown at the top whenever validation fails, headed "There is a problem",
 * one link per error to its field, same wording as the inline message,
 * receives focus so screen-reader and keyboard users land on it, and the
 * page title gains "Error: ".
 */
import { useEffect, useRef } from "react";

export interface SummaryError {
  fieldId: string;
  message: string;
}

export function ErrorSummary({ errors }: { errors: SummaryError[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errors.length === 0) return;
    ref.current?.focus();
    const original = document.title;
    if (!original.startsWith("Error: ")) document.title = `Error: ${original}`;
    return () => {
      document.title = original.replace(/^Error: /, "");
    };
  }, [errors]);

  if (errors.length === 0) return null;
  return (
    <div className="error-summary" ref={ref} tabIndex={-1} aria-labelledby="error-summary-title" role="alert">
      <h2 id="error-summary-title">There is a problem</h2>
      <ul>
        {errors.map((e) => (
          <li key={e.fieldId}>
            <a
              href={`#${e.fieldId}`}
              onClick={(ev) => {
                ev.preventDefault();
                document.getElementById(e.fieldId)?.focus();
              }}
            >
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
