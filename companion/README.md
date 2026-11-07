# Patient Companion

The patient-facing application. It helps people organise their own eye-health
records. It is local-first: records stay in the user's browser (IndexedDB),
with no backend server. See the [design specification](../docs/design-spec.md).

**Current version (C1–C4): synthetic practice data only.** The storage layer
refuses any record that is not marked synthetic, so values typed into the form
are stored as practice data with `SYN-` identifiers. Real health information
will only be accepted once encryption, backup, restore and deletion safeguards
exist and have been tested (design-spec section 12, "Gate").

**Rules for this folder:**

- Follow [the safety boundaries](../docs/safety-boundaries.md).
- Do not import or display anything from `research/`.
- Use synthetic data in development, tests and public demonstrations.

## Running it

```sh
cd companion
npm install
npm run dev        # development server
npm test           # unit, contract and integration tests
npm run typecheck
npm run build      # static files in dist/
npm run tokens     # regenerate src/styles/tokens.css after editing design-tokens/tokens.json
```

## Layout

```
src/
  app/        shell, five-section navigation config, repository context
  domain/     measurement schema and types, form validation, formatting (pure)
  storage/    Repository interface; IndexedDB and in-memory implementations; JSON export/import
  synthetic/  seeded SYN- demo data generator
  charts/     axis rule and device segmentation (pure, tested) and the SVG chart
  features/   overview, measurements
  ui/         presentation-only components (banner, badges, error summary, toast)
  styles/     generated tokens.css, app.css, contrast maths
```

## Where the safety rules are enforced

| Rule | Enforced in |
|---|---|
| 3. No interpretation | No thresholds or trend lines in `charts/`; a test rejects clinical words in form messages |
| 5. Date, eye, device, source | Required by `domain/measurement.ts`; device `null` means an explicit "not recorded" |
| 6. Synthetic data labelled | `synthetic` flag tied to `SYN-` ids in the schema; banner, chart label, `_SYNTHETIC` export file names |
| Real-data gate | `ACCEPTS_REAL_DATA = false` in `storage/repository.ts`, checked on every write and import |
