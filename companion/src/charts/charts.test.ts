import { computeYAxis } from "./axis";
import { assignDeviceMarkers, segmentByDevice, summaryText } from "./series";
import { syn } from "../test/factories";

describe("computeYAxis (design-spec 5.3)", () => {
  it("returns null with no data", () => {
    expect(computeYAxis([], 0.1)).toBeNull();
  });

  it("never clips: every value lies strictly inside the domain", () => {
    for (const values of [[47.1], [44, 52.3], [45.5, 45.6, 45.5], [480, 431, 455]]) {
      const res = values[0]! > 100 ? 1 : 0.1;
      const axis = computeYAxis(values, res)!;
      for (const v of values) {
        expect(v).toBeGreaterThan(axis.domain[0]);
        expect(v).toBeLessThan(axis.domain[1]);
      }
    }
  });

  it("uses 10 × resolution padding for a single value (1.0 D for Kmax)", () => {
    const { domain } = computeYAxis([47.3], 0.1)!;
    expect(domain[0]).toBeLessThanOrEqual(46.3);
    expect(domain[1]).toBeGreaterThanOrEqual(48.3);
  });

  it("uses 10% of the range when that is larger", () => {
    const { domain } = computeYAxis([400, 500], 1)!; // range 100 -> padding 10 (> 10 × 1)
    expect(domain[0]).toBeLessThanOrEqual(390);
    expect(domain[1]).toBeGreaterThanOrEqual(510);
  });

  it("does not start at zero", () => {
    expect(computeYAxis([47, 48], 0.1)!.domain[0]).toBeGreaterThan(0);
  });

  it("produces ticks inside the domain", () => {
    const { domain, ticks } = computeYAxis([44.2, 49.8], 0.1)!;
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    for (const t of ticks) expect(t >= domain[0] && t <= domain[1]).toBe(true);
  });
});

describe("segmentByDevice", () => {
  const A = "Device A";
  const B = "Device B";

  it("joins consecutive same-device values and breaks at a device change", () => {
    const data = [
      syn({ id: "SYN-1", date: "2022-01-01", device: A }),
      syn({ id: "SYN-2", date: "2022-06-01", device: A }),
      syn({ id: "SYN-3", date: "2023-01-01", device: B }),
      syn({ id: "SYN-4", date: "2023-06-01", device: B }),
    ];
    const { segments, changes } = segmentByDevice(data);
    expect(segments.map((s) => s.points.map((p) => p.id))).toEqual([["SYN-1", "SYN-2"], ["SYN-3", "SYN-4"]]);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.before.id).toBe("SYN-2");
  });

  it("never connects through 'Device not recorded', even between the same device", () => {
    const data = [
      syn({ id: "SYN-1", date: "2022-01-01", device: A }),
      syn({ id: "SYN-2", date: "2022-06-01", device: null }),
      syn({ id: "SYN-3", date: "2023-01-01", device: A }),
    ];
    const { segments, changes } = segmentByDevice(data);
    expect(segments).toEqual([]);
    expect(changes).toHaveLength(2);
  });

  it("keeps the two eyes separate (never merged)", () => {
    const data = [
      syn({ id: "SYN-1", eye: "OD", date: "2022-01-01" }),
      syn({ id: "SYN-2", eye: "OS", date: "2022-02-01" }),
      syn({ id: "SYN-3", eye: "OD", date: "2022-03-01" }),
    ];
    const { segments } = segmentByDevice(data);
    expect(segments).toHaveLength(1);
    expect(segments[0]!.points.map((p) => p.id)).toEqual(["SYN-1", "SYN-3"]);
  });

  it("sorts by measurement date regardless of input order", () => {
    const data = [syn({ id: "SYN-late", date: "2024-01-01" }), syn({ id: "SYN-early", date: "2020-01-01" })];
    expect(segmentByDevice(data).segments[0]!.points[0]!.id).toBe("SYN-early");
  });
});

describe("markers and summary", () => {
  it("gives 'not recorded' a ring and each device its own shape", () => {
    const markers = assignDeviceMarkers([syn({ device: "A" }), syn({ device: null }), syn({ device: "B" })]);
    expect(markers.get(null)).toBe("ring");
    expect(markers.get("A")).not.toBe(markers.get("B"));
  });

  it("writes the spec's summary sentences", () => {
    expect(summaryText([])).toMatch(/No measurements/);
    expect(summaryText([syn({ device: "A" })])).toBe("One measurement recorded (A).");
    expect(summaryText([syn({ device: "A" }), syn({ device: "B" }), syn({ device: "A" }), syn({ device: null })])).toBe(
      "Showing 4 measurements from 2 devices. 1 entry has no device recorded.",
    );
  });
});
