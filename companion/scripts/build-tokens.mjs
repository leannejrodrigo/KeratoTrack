// Generates src/styles/tokens.css from design-tokens/tokens.json.
// Run with `npm run tokens` after editing the JSON. The generated file is
// committed so the app builds without this step, and a test checks it is
// up to date (src/styles/tokens.test.ts).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tokensToCss } from "../src/styles/tokensToCss.js";

const root = new URL("../../", import.meta.url);
const tokens = JSON.parse(readFileSync(new URL("design-tokens/tokens.json", root), "utf8"));
const out = fileURLToPath(new URL("companion/src/styles/tokens.css", root));
writeFileSync(out, tokensToCss(tokens));
console.log(`Wrote ${out}`);
