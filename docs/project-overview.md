# Project overview

**Status:** P0 draft. The features and goals here are intentions and may
change. The roadmap and phase names are in the [README](../README.md). The rules in [safety-boundaries.md](safety-boundaries.md) take priority
over anything in this document.

## The problem

Keratoconus is a condition in which the cornea thins and changes shape, which
can affect vision. People living with it are often followed over a long period,
and this creates two separate problems that this project looks at.

**For patients: information is scattered and hard to interpret.** Over the years
a person may collect measurements, appointment notes and treatment records,
possibly from different clinics and devices. Terms like *Kmax* and *pachymetry*
are not everyday language. It can be hard to keep a clear record, or to prepare
good questions for a short appointment.

**For research: reported performance may not reflect imperfect conditions.**
Machine-learning models are often evaluated on complete, good-quality data. Real
data can be incomplete or degraded. How models behave in those conditions, and
whether they signal their own uncertainty, is the question the research
component explores. See [research-protocol.md](research-protocol.md).

The two problems are related by subject only. Neither component depends on the
other.

## Component 1: Patient Companion

### Intended users

- **Primary:** adults with keratoconus who want to keep and understand their own
  records.
- **Secondary:** someone helping a person manage their records, such as a family
  member. How to handle use by or for minors has not been decided, and needs to
  be before any real-user release.
- **Reviewers:** employers, supervisors and other technical readers viewing a
  demonstration using synthetic data.

Clinicians are not target users. The application is not designed to support
clinical decisions, and nothing in it should be presented as doing so.

### Initial features

**First version (phases C1 to C4, the MVP):**

- A single local profile, with records kept in the user's browser and no
  backend server.
- Entering Kmax and thinnest corneal thickness measurements for each eye, with
  date, device, unit and source.
- Charts and tables showing the entered values over time, with provenance.
- Synthetic demonstration data only. Real health information is not accepted
  until encryption, backup, recovery and deletion safeguards exist and have
  been tested.

**Next versions (phases C5 to C8):**

- Appointments, including a personal list of questions the user writes for
  their appointments, and treatment records.
- A glossary of terms in accessible language, with sources.
- JSON export and import of the user's own data, and deletion. CSV may be
  added later as an extra export.
- Downloadable summaries containing only what the user entered.

Browser storage is not a backup. Users will need to export their records to
protect against data loss.

## Component 2: Research Laboratory

A separate, experimental environment for studying machine learning and computer
vision using corneal topography images and clinical measurements. Its current
focus is the robustness, calibration and uncertainty of keratoconus
classification models when measurements are missing or images are degraded.

Its outputs are experimental results for technical readers. They are not
clinical tools and do not reach the Companion.

## Long-term goals

- **Learning:** develop real understanding of software engineering and AI/ML
  engineering, with decisions that can be explained and defended.
- **Portfolio:** build a technically credible project that demonstrates careful
  work in a sensitive domain.
- **Research:** work towards an independent research paper and potentially a
  peer-reviewed publication, if the literature review, dataset audit and results
  support one. This is an aim, not an expected outcome.
- **Usefulness:** make a Companion that a person with keratoconus could
  genuinely find helpful for organising their information.

## Scope

### In scope

- Recording, organising, charting and exporting user-entered information.
- General educational explanations of terminology.
- Supporting users in preparing questions for their clinician.
- Offline research experiments on properly licensed data.
- Synthetic data for development and demonstrations.
- Documenting limitations, including negative results.

### Out of scope

- Diagnosing or screening for keratoconus.
- Recommending or ranking treatments.
- Determining or predicting disease progression.
- Clinical risk scores or treatment decisions.
- Showing research model outputs to patients.
- Clinical deployment or claims of clinical validity.
- Real patient data in public demonstrations.
- Integrating with clinic systems or topography devices.

### Not yet decided

- Whether a multi-user, hosted version will ever handle real users' data. This
  would need security, legal and ethical review first.
- Which research dataset to use, pending an audit.
- Which legal or regulatory requirements would apply to any real-user release.
- The project's open-source licence.
