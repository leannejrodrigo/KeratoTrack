// Pure function shared by the build script and the freshness test.
// Plain JavaScript (with JSDoc types) so Node can run it without a TS step.

/**
 * @param {Record<string, any>} tokens
 * @returns {string}
 */
export function tokensToCss(tokens) {
  const lines = [
    "/* GENERATED from design-tokens/tokens.json by `npm run tokens`. Do not edit by hand. */",
    ":root {",
  ];
  for (const group of ["color", "series", "space", "radius", "font", "companion-type"]) {
    const prefix = group === "color" ? "" : group === "companion-type" ? "type-" : `${group}-`;
    for (const [name, value] of Object.entries(tokens[group] ?? {})) {
      if (name.startsWith("$")) continue;
      lines.push(`  --${prefix}${name}: ${value};`);
    }
  }
  lines.push("}", "");
  return lines.join("\n");
}
