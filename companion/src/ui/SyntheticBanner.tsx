/** Persistent, unmissable label (design-spec 8.1). Not dismissible. */
export function SyntheticBanner() {
  return (
    <div className="synthetic-banner" role="note" aria-label="Synthetic data notice">
      <span className="synthetic-tag">SYNTHETIC DATA</span>
      <span className="banner-long">Not real patient information. This version stores practice data only. Do not enter your real measurements.</span>
      <span className="banner-short">Practice data only. Do not enter real measurements.</span>
    </div>
  );
}
