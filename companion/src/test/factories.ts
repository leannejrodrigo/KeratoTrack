import type { Measurement } from "../domain/measurement";

let n = 0;
/** Build a valid synthetic measurement for tests, overriding any field. */
export function syn(overrides: Partial<Measurement> = {}): Measurement {
  n += 1;
  return {
    id: `SYN-test-${n}`,
    kind: "kmax",
    eye: "OD",
    date: "2025-01-01",
    value: 47.2,
    unit: "D",
    device: "Device A (synthetic)",
    source: "syntheticDemo",
    synthetic: true,
    createdAt: "2026-11-07T10:00:00.000Z",
    updatedAt: "2026-11-07T10:00:00.000Z",
    ...overrides,
  };
}
