# Patient Companion

The patient-facing application will live here. It helps people organise their
own eye-health records. No code exists yet.

It is planned as a local-first web application (React, TypeScript and Vite):
records stay in the user's browser, with no backend server in the initial
version. Browser storage is not a backup, so users will need to export their
records to protect against data loss. See the
[design specification](../docs/design-spec.md).

**Rules for this folder:**

- Follow [the safety boundaries](../docs/safety-boundaries.md).
- Do not import or display anything from `research/`.
- Use synthetic data in development, tests and public demonstrations. The
  initial version accepts synthetic data only.
