import { useEffect } from "react";

export interface ToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Polite live region; stays 10 s (long enough to reach the Undo button). */
export function Toast({ toast, onClose }: { toast: ToastState | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 10_000);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  return (
    <div className="toast-region" aria-live="polite">
      {toast && (
        <div className="toast">
          <span>{toast.message}</span>
          {toast.onAction && (
            <button type="button" className="btn btn-link-inverse" onClick={() => { toast.onAction!(); onClose(); }}>
              {toast.actionLabel}
            </button>
          )}
          <button type="button" className="btn btn-link-inverse" onClick={onClose} aria-label="Dismiss message">×</button>
        </div>
      )}
    </div>
  );
}
