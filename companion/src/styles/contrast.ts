/**
 * WCAG 2.2 contrast ratio.
 *
 * Relative luminance L = 0.2126 R + 0.7152 G + 0.0722 B, where each channel
 * is first converted from sRGB (gamma-encoded) to linear light:
 *   c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ^ 2.4
 * The weights reflect how sensitive human vision is to each primary (green
 * dominates). Contrast ratio = (L_lighter + 0.05) / (L_darker + 0.05); the
 * 0.05 models ambient flare, and keeps the ratio finite for pure black.
 * The range is 1:1 (identical colours) to 21:1 (black on white).
 */
export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Not a 6-digit hex colour: ${hex}`);
  const int = parseInt(m[1]!, 16);
  const channels = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = channels as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
