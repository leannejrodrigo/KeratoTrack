// @vitest-environment node
import { readFileSync } from "node:fs";
import { contrastRatio } from "./contrast";
import { tokensToCss } from "./tokensToCss.js";

const tokens = JSON.parse(
  readFileSync(new URL("../../../design-tokens/tokens.json", import.meta.url), "utf8"),
) as {
  color: Record<string, string>;
  "contrast-requirements": { pairs: { fg: string; bg: string; min: number }[] };
};

describe("contrast maths", () => {
  it("matches the WCAG reference extremes", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });
});

describe("design token contrast (WCAG 1.4.3, 1.4.6, 1.4.11)", () => {
  for (const { fg, bg, min } of tokens["contrast-requirements"].pairs) {
    it(`${fg} on ${bg} is at least ${min}:1`, () => {
      const ratio = contrastRatio(tokens.color[fg]!, tokens.color[bg]!);
      expect(ratio).toBeGreaterThanOrEqual(min);
    });
  }
});

describe("generated tokens.css", () => {
  it("is up to date with tokens.json (run `npm run tokens` if this fails)", () => {
    const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
    expect(css).toBe(tokensToCss(tokens));
  });
});
