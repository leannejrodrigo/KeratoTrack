# KeratoTrack design specification

**Status:** approved provisional design baseline (v4, 2026-11-07). This is a
**specification of intended design**, not a description of what has been built.
Changes are recorded in the change log at the end rather than silently
replacing approved decisions. Where this document and
[safety-boundaries.md](safety-boundaries.md) disagree, the safety boundaries
win.

**Evidence labels** used in this document:

| Label | Meaning |
|---|---|
| **[V]** | Verified against a primary source on 2026-11-07 (see the verification register) |
| **[S]** | Checked against secondary sources only |
| **[K]** | Based on existing knowledge, not verified |
| **[R]** | A design recommendation (judgement, not fact) |
| **[A]** | An assumption that still needs confirming |

## Confirmed decisions

These may only change through a recorded decision.

| Area | Decision |
|---|---|
| Companion navigation | Five sections: Overview · My Eyes · Appointments · Records · Library |
| Image viewer | Neutral mid-grey image well `#3A3D42`; rest of the interface light. Image pixels are never altered, including to add synthetic-data labels |
| Treatment events on charts | Hidden by default; optional "Show recorded events" control |
| Typography | Inter for interface text; JetBrains Mono for technical details (IDs, checksums, paths, configurations). Both SIL OFL 1.1 **[V]** |
| Dark theme | Design tokens structured to allow it; not implemented initially |
| Frontend | React, TypeScript and Vite |
| Companion storage | Local-first IndexedDB behind a Repository interface; no backend initially |
| Charts | React-rendered SVG with D3 used for maths only |
| Export | JSON is the complete export and import format; CSV possibly later |
| Companion MVP | Synthetic data only; no hosting |
| Research MVP | Python audit scripts and static HTML/Markdown reports; the interactive Research Laboratory interface is deferred |
| Research data | Outside the repository, in the folder named by `KERATOTRACK_DATA_DIR` (locally `C:\dev\KeratoTrack-data\`) |
| Patient testing | Deferred pending appropriate guidance and ethics requirements |

---

## 1. Brand identity and visual principles

**Direction:** "Clinical instrument, light". Precise, calm and honest. Not a
generic healthcare dashboard or AI-startup interface.

**Users.**

- *Patient Companion:* people with keratoconus, whose vision and preferences
  vary widely. The design provides a readable default (large text, strong
  contrast) and respects each user's own settings: browser text size, zoom,
  reduced motion and system contrast modes. The off-white canvas is a brand and
  comfort choice **[R]**; it is not claimed to reduce glare.
- *Research Laboratory:* a researcher at a desktop who needs density and
  precision.

**Principles [R].**

| Principle | Meaning |
|---|---|
| Provenance first | Every value carries its date, eye, device and source |
| Neutral about health | Nothing judges a value, implies progression, or shows thresholds or "normal" ranges |
| Quiet structure | Type, spacing and fine rules; no gradients, glows, illustrations or card clutter |
| Honest data | Transparent scaling, visible gaps and device changes, uncertainty shown, synthetic data unmistakable |
| One family, two rooms | Shared tokens and type; layouts suited to each set of users |
| Enforce in the system, show in the interface | Rules live in data models and pipelines; the interface reflects them |

## 2. Colour palette

Contrast ratios are hand-calculated **[K]** and are checked by an automated
token contrast test.

| Token | HEX | Purpose |
|---|---|---|
| `canvas` | `#F8F7F4` | App background |
| `surface` | `#FFFFFF` | Panels, fields |
| `surface-subtle` | `#F1F0EC` | Table headers, selected rows |
| `border` | `#E3E1DB` | Decorative dividers only |
| `border-control` | `#8A8F99` | Control boundaries (≥3:1, WCAG 1.4.11 **[V]**) |
| `text-primary` | `#1A2233` | Body text (about 15:1) |
| `text-secondary` | `#4A5468` | Labels (about 7.6:1) |
| `text-tertiary` | `#646C7E` | Research metadata only (about 5:1) |
| `navy-700` | `#1B2F55` | Primary brand, primary buttons, active navigation |
| `navy-900` | `#111E38` | Pressed state, wordmark |
| `navy-50` | `#EDF0F6` | Selected background |
| `teal-600` | `#2F7F7A` | Accent, Right-eye series |
| `teal-700` | `#23645F` | Teal for small text and links |
| `teal-50` | `#E8F2F1` | Badge tint |
| `blue-600` | `#3A64A8` | Focus ring, info |
| `blue-50` | `#ECF1F9` | Info banner background |
| `success` / `warning` / `danger` / `info` | `#2E7D4F` / `#8A5A00` / `#B42318` / `#3A64A8` | **Software state only, never measurements** |
| `viewer-surround` | `#3A3D42` | Image well only |
| `synthetic` | `#B07D2B` | Outline of the SYNTHETIC label |

**Data series.** Right eye (OD): teal, circle markers. Left eye (OS): navy,
square markers. Research series: navy, teal, blue, ochre `#B07D2B`, plum
`#7A4E8C`, slate, each with a distinct marker shape; at most six per chart.

Tokens are named by role, not hue, so a future dark theme supplies new values
for the same roles. Carbon uses the same principle: tokens and roles stay fixed
across themes and only values change **[V]**.

## 3. Typography

Inter (interface; supports tabular numbers; variable font **[V]**) with tabular
figures for all numbers. JetBrains Mono for technical details. Both self-hosted.

| Role | Companion | Research | Weight |
|---|---|---|---|
| Page title | 30px | 24px | 600 |
| Section heading | 24px | 18px | 600 |
| Subheading | 20px | 16px | 600 |
| Body | 18px | 14px | 400 |
| Label / table | 16px | 13px | 500 |
| Caption / provenance | 15px | 12px | 400 |
| Key value | 28px, tabular | — | 500 |

Sizes in rem so they follow the user's browser setting. No weight below 400.
Line height 1.5 for body text, 1.3 for headings.

## 4. Spacing and layout

Spacing scale (4px base): 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96.
Companion density: 16 / 24–32 / 48px. Research density: 8 / 16 / 32px. Radius
4px on controls, 6px on panels. Shadows only on floating layers. Companion: one
reading column, maximum 720px (880px for charts). Research: fluid 12-column
grid with sidebar, main area and detail panel.

## 5. Patient Companion

### 5.1 Navigation

Overview · My Eyes (Timeline, Measurements) · Appointments (including a
personal list of questions) · Records (Treatments, Reports) · Library. Bottom
tabs on mobile, navigation rail on tablet, sidebar on laptop and desktop.
Sections appear only once they are built.

### 5.2 Pages

- **Overview:** next appointment; recent entries with full provenance and no
  arrows or change values; quick actions; a first-run explanation of what the
  app does and does not do.
- **My Eyes → Measurements:** eye selector (Right (OD) | Left (OS) | Both),
  measurement selector, chart and table views, date filter.
- **My Eyes → Timeline:** chronological, expandable, descriptive only.
- **Appointments:** upcoming and past; calendar export; generic reminder
  wording; a **personal question list** the user writes themselves. The app
  never generates medical questions or advice; only the general prompts allowed
  by the safety boundaries may be offered.
- **Records → Treatments:** dated events with eye, provider, source and notes.
  The chart overlay is off by default; when on, events are neutral markers with
  text labels and the note "Events are shown for reference. Their position does
  not indicate an effect on measurements."
- **Records → Reports:** PDF of recorded data with provenance; no
  interpretation; footer "Personal record, not a clinical document".
- **Library:** searchable articles with sources, a last-reviewed date and
  "General information, not personal advice"; linked glossary.
- **Source badges:** "From clinic report (uploaded by you)" and "Entered by
  you", using icon and text as well as colour.

### 5.3 Clinical measurement charts

**No clinical thresholds.** No reference ranges, "normal" bands, cut-offs,
colour zones or clinically chosen axis spans.

**Transparent, data-dependent scaling [R].**

1. Axis bounds are the lowest and highest values in view, minus and plus
   padding.
2. Padding is the larger of 10% of the data range, or 10 × the reporting
   resolution stored with the values (for example 0.1 D gives 1.0 D). The
   multiplier is a documented display constant, not a clinical number.
3. Bounds extend to tidy tick values. Values are never clipped.
4. "Both eyes" views share one axis.
5. A caption always reads: "Axis range is fitted to the recorded values and does
   not start at zero." An info control explains the rule.

**Axes and units.** Axis titles include units ("Kmax (D)", "Thinnest corneal
thickness (µm)"). Real-time x-axis with unambiguous dates ("3 Mar 2026"). No
bars for measurements.

**Device changes stay visible.** Device is required, with an explicit "Device
not recorded" category. Distinct marker per device and a legend. Thin
connectors join consecutive same-device values only and break at each device
change, labelled "Device changed: values may not be directly comparable."
Whether values from different devices are interchangeable is a clinical claim
**[K]** to be addressed by literature; breaking the line is the safe default
either way.

**Missing measurements stay visible.** No zeros, no interpolation. Tables show
"Not recorded". A summary line states counts, for example "Showing 4
measurements from 2 devices. 1 entry has no device recorded." A single value is
labelled "One measurement recorded."

**Neutral language.** Facts only; never "increase", "worse", "stable" or
"progression". The table and a factual summary are always available: the NHS
service manual notes that more than 6 in 10 adults struggle with health content
that includes numbers and statistics **[V]**.

**Later (optional):** a "Fit to data" zoom with a persistent notice that small
differences appear larger.

## 6. Research Laboratory

### 6.1 Interface (deferred)

Navigation: Overview; Data (Dataset explorer, Data quality audit, Image
viewer); Experiments (Runs, Model comparison, Robustness, Calibration &
uncertainty); Reports. A provenance bar shows dataset version and checksum,
REAL or SYNTHETIC mode, active split and test-set status read from the
pipeline. In the MVP, the same information is produced as static reports.

### 6.2 No fabricated results

Empty states until real runs exist. Example content only as SYN-labelled
synthetic data. Every statistic links to the script run that produced it.

### 6.3 Research integrity

A visual lock is not protection. Enforcement lives in the pipeline; any
interface only reports its state.

- **Frozen split with a separate manifest.** Assignment file (patient → split)
  outside the repository. Committed manifest: dataset ID, version and checksum;
  split method, parameters and seed; code commit; creation time; checksum of
  the assignment file; computed counts per split. No patient codes. Every run
  verifies the checksum and refuses on mismatch.
- **Splitting.** Validate identifiers first, then split by patient with
  group-aware methods. scikit-learn's `StratifiedGroupKFold` keeps groups out of
  both train and test, but its stratification is best-effort **[V]**, so label
  balance must be checked and reported.
- **Near-duplicate checks.** Exact and near tabular duplicates; same ID with
  conflicting values; exact image duplicates by SHA-256; near image duplicates
  by perceptual hash and Hamming distance (`imagehash` **[V]**). Thresholds are
  recorded and reported at more than one level; flagged pairs are reviewed.
- **Data roles.** Training: fit all preprocessing and model parameters.
  Validation: model selection, hyperparameters, thresholds and calibration,
  where appropriate (with care if both selection and calibration reuse the same
  data). Test: final evaluation only.
- **Guarded evaluation command.** Refuses unless the protocol is final, the
  tree is clean, manifest and configuration checksums match, and all previous
  log entries are committed. It assigns the next sequential evaluation number,
  writes an "intent" entry before loading test data, evaluates, and appends a
  "completed" entry with the result checksum.
- **Access log.** JSON Lines; each entry records evaluation number, status,
  UTC timestamp, commit, protocol version, manifest checksum, run ID,
  configuration and model checksums, purpose, result checksum and the
  checksum of the previous entry.
- **Limitations.** Git history can be rewritten; local edits are detectable,
  not preventable; timestamps are self-reported; ad-hoc code can bypass the
  loader; no log proves an absence. The log is **not tamper-proof**. Integrity
  also rests on committing the protocol in advance, honest reporting of the
  number of test evaluations, and labelling post hoc analysis as exploratory.

## 7. Key interactions

Eye selection persists for the session and is announced. Adding a measurement
requires eye, date, device (or "not recorded"), value, unit and source type;
validation rejects impossible values or wrong units without clinical judgement.
Chart points expose provenance by hover, tap or keyboard. Single-record delete
offers undo; delete-all requires typed confirmation. Export warns that the file
leaves the app's protection. Every drag action has a button or keyboard
alternative (WCAG 2.5.7 **[V]**). Test-set access is a pipeline command only.

## 8. Shared design system

**Shared:** tokens, icon set, form controls, buttons, badges, dialogs,
notifications, empty/loading/error patterns, chart building blocks. **Shared
with different density:** control height (44px preferred in the Companion,
32px in Research), tables. **Separate:** navigation shells, data grid, image
viewer, provenance bar, tone of voice.

**Boundary [R]:** shared code is presentation-only and never accesses patient
records or research data.

**Forms** follow the GOV.UK error summary pattern **[V]**: shown whenever
validation fails, at the top of the main content, headed "There is a problem",
linking to each field, matching inline wording, receiving focus, and adding
"Error:" to the page title.

### 8.1 Synthetic data

- On screen: a persistent banner "SYNTHETIC DATA: not real patient
  information"; a SYNTHETIC chart label and legend entries; no hatching or
  overlays; image labels in the viewer frame, never on pixels.
- In exports: the label inside the figure area and `_SYNTHETIC` in file names.
- In data: an immutable `synthetic` field; `SYN-` identifiers.
- In storage: a separate demo database; synthetic research datasets cannot be
  registered under real dataset names.

## 9. Accessibility

Baseline WCAG 2.2 Level AA (W3C Recommendation, version of 12 December 2024
**[V]**), with AAA contrast where practical.

| SC | Requirement **[V]** | Application **[R]** |
|---|---|---|
| 1.4.1 (A) | Colour not the only means | Text or shape for eyes, devices, sources, states |
| 1.4.3 (AA) | 4.5:1 text, 3:1 large text | Every text token |
| 1.4.6 (AAA) | 7:1 text | Target for Companion body text and key values |
| 1.4.4 (AA) | Resize text to 200% | rem-based type |
| 1.4.10 (AA) | Reflow at 320 CSS px | Single-column Companion |
| 1.4.11 (AA) | 3:1 for component boundaries and graphics | `border-control`, focus ring, chart marks |
| 1.4.12 (AA) | Survives increased text spacing | Flexible layouts |
| 2.1.1 / 2.1.2 (A) | Keyboard operable, no traps | All controls, charts, dialogs |
| 2.4.7 (AA) | Visible focus | 2px `blue-600` ring |
| 2.4.11 (AA) | Focus not entirely obscured | Scroll padding under sticky bars |
| 2.4.13 (AAA) | 2px focus perimeter, 3:1 change | Target |
| 2.5.5 (AAA) | 44×44 CSS px targets | Companion design preference |
| 2.5.7 (AA) | Non-drag alternative | Zoom and pan buttons |
| 2.5.8 (AA) | 24×24 CSS px minimum | Research minimum |
| 3.3.1 (A) | Errors identified in text | Inline errors and error summary |
| 3.3.7 (A) | No redundant re-entry | Reuse last device and source |
| 3.3.8 (AA) | No cognitive test for login | Future app lock allows paste and password managers |

**Testing:** automated token contrast test; accessibility lint rules **[K]**;
`@axe-core/playwright` (automated checks find only some problems **[V]**);
manual keyboard checklist; NVDA plus one mobile screen reader; zoom and
text-spacing checks; colour-blindness emulation and Windows contrast themes. No
reliance on readability scores (NHS guidance **[V]**). Testing with real users
is deferred.

## 10. Responsive design

| Breakpoint | Companion | Research |
|---|---|---|
| Mobile (<640px) | Primary target: bottom tabs, full-width charts, table one tap away | Reports readable; later review-only interface |
| Tablet (640–1023px) | Navigation rail | Later: collapsible panels |
| Laptop (1024–1439px) | Sidebar and reading column | Later: icon sidebar and detail panel |
| Desktop (≥1440px) | As laptop; extra space becomes whitespace | Later primary target: three panes |

## 11. Design references

| Reference | Lesson | Status |
|---|---|---|
| GOV.UK Design System | Error summary pattern for all forms | [V] |
| NHS service manual | Tables and factual summaries alongside charts; plain language; user testing over readability scores | [V] |
| Apple Health | Sources visible and prioritisable per data type; KeratoTrack goes further with provenance per value | [V] (per-sample attribution not confirmed) |
| Epic MyChart | Separate clinician-provided from patient-entered information | [S] |
| OHIF Viewer | Open-source web imaging viewer (MIT, Cornerstone3D, React) | [V] (dark-surround convention [K]) |
| 3D Slicer | Annotation and measurement patterns; warning about tool overload | [V] |
| MLflow | Runs data model: parameters, code version, metrics, artefacts; local use without a server | [V] (licence [K]) |
| Weights & Biases | Run comparison with a "Diff only" toggle | [V] |
| Our World in Data | Provenance, citation and data download with every chart | [V] (direct-labelling style [K]) |
| IBM Carbon | Role-based theme tokens; table densities 24/32/40/48/64px | [V] |

## 12. Security, privacy and data governance

| Topic | Initial local prototype (synthetic only) | Future deployed application |
|---|---|---|
| Authentication | None needed. Before real data: app lock whose passphrase derives the encryption key | Established provider or vetted library; passkeys and MFA; secure sessions; rate limiting |
| Encryption in transit | Local development server. Web Crypto requires a secure context **[V]** | HTTPS with HSTS |
| Encryption at rest | Not needed for synthetic data. Before real data: AES-GCM (authenticated **[V]**) with unique random 12-byte IVs; key from PBKDF2-HMAC-SHA256 at 600,000 iterations or Argon2id (19 MiB, t=2, p=1) per OWASP **[V]** | Provider encryption minimum; preferably end-to-end |
| Storage | IndexedDB behind the Repository interface; ISO calendar dates; UUIDs; schema versions; separate demo and real databases | Relational database with per-user isolation |
| Browser eviction | Best-effort storage can be evicted; `navigator.storage.persist()` exempts a site from pressure eviction; Safari deletes script-created data after seven days of browser use without interaction when tracking prevention is on **[V]**. Whether installed home-screen apps are exempt is **[A]** | Server is the source of truth |
| Backups | JSON export and validated import. Before real data: encrypted backups, reminders, tested restore. **Browser storage is not a backup** | Encrypted automated backups, restore drills, documented retention |
| Export and deletion | Full JSON export; permanent deletion after an undo window; typed-confirmation delete-all | Self-service export and deletion; backup expiry documented |
| Attachments | Not in the MVP. Later: type checked by content, size limits, encryption, EXIF removal, sandboxed PDF rendering | Private storage, short-lived signed URLs, malware scanning |
| Separation | Separate apps and storage; no data path between Companion and Research | Same, separate infrastructure |
| Repository protection | `.gitignore`, data outside the repository, staged-file guard hook, secret scanning, notebook output stripping, review before every commit | Same plus CI scanning and protected branches |

**Gate:** no real health data until encryption, backup, restore and deletion
are implemented and tested, and the Safari eviction question is resolved.

## 13. Planned architecture

```
design-tokens/tokens.json ──► CSS variables (Companion)
                          └─► chart style and report CSS (Research)

companion/ (React + TS + Vite)            research/ (Python)
  app/       shell, navigation config       config/      dataset registry, data dir from env
  features/  overview, measurements, ...    synthetic/   synthetic test datasets
  domain/    types, schemas, pure rules     audit/       checks → findings → reports
  storage/   Repository interface           splits/      ID validation, group split, manifest
             ├─ IndexedDB implementation    evaluation/  guarded loader, access log
             └─ in-memory (tests)           reports/     static HTML/Markdown
  synthetic/ SYN- data generator            plotting/    chart style from tokens
  ui/, charts/  presentation only

        NO DATA PATH BETWEEN COMPANION AND RESEARCH
Research data, split assignments and predictions: outside the repository.
```

The shared presentation layer starts inside `companion/` with a lint rule
blocking imports from storage, and moves to its own package when the Research
web interface begins.

## Verification register

Sources accessed on 2026-11-07: W3C WCAG 2.2; GOV.UK Design System (error
summary); NHS service manual (content, health literacy); MDN (storage quotas and
eviction, SubtleCrypto.encrypt); OWASP Password Storage Cheat Sheet;
scikit-learn `StratifiedGroupKFold`; Playwright accessibility testing; OHIF
docs; 3D Slicer; MLflow Tracking; Weights & Biases Run Comparer (CoreWeave-hosted
docs); Carbon themes and data table; Apple Support (Health data sources); Our
World in Data chart pages; Vite guide; Zod; Dexie; GitHub repositories for
Observable Plot, Inter, JetBrains Mono, imagehash, nbstripout and gitleaks.
MyChart claims rely on hospital help pages (secondary). Unverified: NIST IV
guidance, MLflow and Zod licences, Observable Plot internals, GitHub branch
protection, Safari home-screen exemption, clinical claims (for the literature
review).

## Change log

| Date | Change |
|---|---|
| 2026-11-07 | v4 approved as the provisional design baseline |
| 2026-11-07 | Recorded later decisions: data directory `C:\dev\KeratoTrack-data\` via `KERATOTRACK_DATA_DIR`; personal question list in Appointments; MIT licence for original code only; "independent reviewer, to be identified"; the name "Research Laboratory" |
