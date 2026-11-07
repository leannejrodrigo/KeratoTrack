# Safety boundaries

**Status:** in force from Phase 0. These rules apply to all code, content,
documentation and demonstrations in this project.

**Why these exist:** a person reading health software can reasonably take what
it shows as medical guidance, even when a disclaimer says otherwise. So these
rules limit what the software does, rather than relying on warnings.

If a feature conflicts with a rule, the feature changes. A rule changes only
through a deliberate, reviewed edit to this file that records the reason.

## Rules for the patient application

### 1. It must not diagnose keratoconus

It must not state, suggest or estimate whether a person has keratoconus or any
other condition. A diagnosis may appear only as something the user recorded.

### 2. It must not recommend treatments

It must not recommend, rank, compare for suitability, or discourage any
treatment. It may store treatments the user records, and may explain in general
terms what a treatment is.

### 3. It must not independently interpret measurements as proof of progression

It displays values, and leaves interpretation to the user and their clinician.
This includes implied interpretation, so the application must not:

- Describe measurements as improving, worsening, stable or progressing.
- Apply clinical thresholds to decide whether a change matters.
- Add fitted trend lines, forecasts, or "normal" and "danger" zones to charts.
- Use colours, icons or alerts that imply a clinical judgement.

A clinician's own statement may be stored when the user records it, attributed
as such. For example: "Dr's note, 3 March: ...".

### 4. It must not generate clinical risk scores or treatment decisions

It must not produce any score, category, probability or ranking that represents
clinical risk, severity, urgency or the need for treatment. This holds even if
the output is labelled as an estimate or for information only.

### 5. Measurements must retain their date, eye, device and source

Every stored measurement keeps:

| Field | Meaning | Why it matters |
|---|---|---|
| **Date** | When the measurement was taken, not when it was entered | Keeps the record's timeline correct |
| **Eye** | Right or left | The two eyes are separate records and must not be merged |
| **Device** | The instrument used, or an explicit "unknown" | Values from different devices may not be directly comparable |
| **Source** | Where the value came from, such as a clinic report or demo data | Shows how far the value can be relied on |

These details must also appear wherever the value is shown or exported.
Measurements from different devices must not be silently presented as one
continuous series.

## Rules for data

### 6. Public demonstrations must use synthetic data

Screenshots, videos, hosted demos, slides and sample files use only synthetic
data, and that data is clearly labelled. Synthetic data must not be derived from
a real person's records.

### 7. Identifiable patient data must never be committed to GitHub

This covers names, dates of birth, contact details, record numbers, and clinical
reports or images that could identify someone, including the developer's own.

- `.gitignore` reduces the risk of accidents, but does not guarantee safety.
  Check staged files before each commit.
- Research datasets are not committed, even when they have been anonymised.
  Download them from their original source and verify them instead.
- If identifiable data is ever committed, treat it as an incident. Deleting it
  in a later commit does not remove it from Git history, and anything pushed
  must be assumed to have been copied. Stop, make the repository private if
  possible, remove the data from history and work out what else is needed.

## Rules for the research component

### 8. Research predictions must remain separate from the patient application

- The Companion must not import, call, display or store research models or their
  outputs, and the research code must not read Companion user data.
- Patient-facing content must not cite research results as evidence about a
  user's own eyes.
- Research results must always be described as experimental. See
  [research-protocol.md](research-protocol.md).

## What the application may do

These are examples, not a complete list.

| Allowed | Not allowed |
|---|---|
| "Kmax, right eye: 48.2 D, 3 March 2026, Pentacam, from clinic report" | "Your Kmax is high" |
| Plotting entered values against their dates | Adding a trend line or forecast to that chart |
| "You have 2 measurements recorded for this eye" | "Your right eye has changed significantly" |
| "Kmax is the steepest point measured on the cornea" (general, sourced education) | "A Kmax of 48 means you have moderate keratoconus" |
| "Please check this value: it looks like a possible typing error" | "This value is abnormal" |
| Offering general prompts, such as "What do these results mean for me?" | "You should ask about cross-linking" |

Data-entry checks may catch impossible or mistyped values, such as a Kmax of
5.7 D. Their wording must be about the entry, never about the person's health.

## Situations needing extra care

- **Summaries and reports:** must contain only what the user entered, in neutral
  language, and must state that they are not a clinical assessment.
- **Generated text:** LLM-generated content is not planned for the application,
  because its output cannot be fully controlled. Adding it would need an
  explicit change to this document.
- **New symptoms or concerns:** the application must not assess them. Where
  appropriate, it should direct users to an eye-care professional or local
  emergency services.

## When unsure

If it is unclear whether a feature crosses a line, assume that it does until the
question has been reviewed. Ideally, a clinician reviews patient-facing content
before any real-user release.
