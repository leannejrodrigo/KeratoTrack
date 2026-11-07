# ADR 0001: Local-first Companion with no backend

**Date:** 2026-11-07 · **Status:** Accepted

## Context

The Companion stores personal health records. A server-based design would make
the project the custodian of health data, requiring authentication, server
security, breach response and possibly legal obligations. That is
disproportionate for a first version built by one developer, especially while
only synthetic data is used.

## Decision

The Companion stores data in the user's browser (IndexedDB) behind a
`Repository` interface. There is no backend server in the initial version. The
MVP accepts synthetic data only.

## Alternatives considered

- **Cloud accounts with sync:** convenient across devices, but brings all the
  custodian responsibilities above.
- **Local-first plus end-to-end encrypted sync:** possible later, but
  cryptographically and operationally complex.

## Consequences

- No server to breach and no hosting cost.
- No sync between devices.
- **Browser storage is not a backup.** Browsers may evict data (Safari deletes
  script-created data after seven days without user interaction when tracking
  prevention is on), so users must export their records. JSON export is
  therefore a core feature, not an extra.
- The `Repository` interface keeps a future backend possible without rewriting
  the interface code.
- Before real data: encryption, app lock, backup, restore and deletion must be
  implemented and tested.
