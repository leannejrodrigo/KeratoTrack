"""Static audit reports (ADR 0005): Markdown and HTML with a provenance footer.

Reports quote example identifiers so problems can be found and fixed, which
means they can contain patient codes. They are therefore written to the data
folder OUTSIDE the repository, never into it.

Colours come from design-tokens/tokens.json, so reports match the Companion.
"""

from __future__ import annotations

import html
import json
from datetime import datetime, timezone
from pathlib import Path

from .audit import PLAUSIBILITY_LIMITS, Finding
from .config import REPO_ROOT

SEVERITY_ORDER = {"blocker": 0, "warning": 1, "info": 2}


def _provenance(dataset_id: str, sha: str, rows: int, synthetic: bool, commit: str, when: datetime) -> list[tuple[str, str]]:
    return [
        ("Dataset", dataset_id),
        ("Mode", "SYNTHETIC" if synthetic else "REAL"),
        ("Dataset SHA-256", sha),
        ("Rows", str(rows)),
        ("Code commit", commit),
        ("Generated (UTC)", when.isoformat(timespec="seconds")),
        ("Data-entry limits", json.dumps(PLAUSIBILITY_LIMITS)),
    ]


def render_markdown(findings: list[Finding], *, dataset_id: str, sha: str, rows: int, synthetic: bool, commit: str, when: datetime | None = None) -> str:
    when = when or datetime.now(timezone.utc)
    lines = [f"# Dataset audit: {dataset_id}", ""]
    if synthetic:
        lines += ["> **SYNTHETIC DATA.** Not real patient information. These findings describe planted test issues, not any real dataset.", ""]
    lines += ["> Audit findings describe data quality only. They make no clinical claim.", ""]
    blockers = sum(f.severity == "blocker" for f in findings)
    lines += [f"**{len(findings)} findings, {blockers} blocker{'s' if blockers != 1 else ''}.** Blockers must be resolved, with the decision documented, before a split is frozen.", ""]
    lines += ["| Severity | Check | Count | Finding | Examples |", "|---|---|---:|---|---|"]
    for f in sorted(findings, key=lambda f: (SEVERITY_ORDER[f.severity], f.check)):
        ex = "<br>".join(f"`{e}`" for e in f.examples) or ""
        lines.append(f"| {f.severity} | `{f.check}` | {f.count} | {f.message} | {ex} |")
    lines += ["", "## Provenance", ""] + [f"- **{k}:** `{v}`" for k, v in _provenance(dataset_id, sha, rows, synthetic, commit, when)]
    return "\n".join(lines) + "\n"


def _tokens() -> dict[str, str]:
    path = REPO_ROOT / "design-tokens" / "tokens.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))["color"]
    except (OSError, KeyError, json.JSONDecodeError):
        return {}


def render_html(findings: list[Finding], *, dataset_id: str, sha: str, rows: int, synthetic: bool, commit: str, when: datetime | None = None) -> str:
    when = when or datetime.now(timezone.utc)
    c = {"canvas": "#F8F7F4", "surface": "#FFFFFF", "text-primary": "#1A2233", "text-secondary": "#4A5468", "border": "#E3E1DB", "danger": "#B42318", "warning": "#8A5A00", "synthetic": "#B07D2B", "surface-subtle": "#F1F0EC", **_tokens()}
    e = html.escape
    sev_color = {"blocker": c["danger"], "warning": c["warning"], "info": c["text-secondary"]}
    rows_html = "".join(
        f"<tr><td style='color:{sev_color[f.severity]};font-weight:600'>{e(f.severity)}</td><td><code>{e(f.check)}</code></td>"
        f"<td class='num'>{f.count}</td><td>{e(f.message)}</td><td>{'<br>'.join(f'<code>{e(x)}</code>' for x in f.examples)}</td></tr>"
        for f in sorted(findings, key=lambda f: (SEVERITY_ORDER[f.severity], f.check))
    )
    prov = "".join(f"<dt>{e(k)}</dt><dd><code>{e(v)}</code></dd>" for k, v in _provenance(dataset_id, sha, rows, synthetic, commit, when))
    banner = f"<p class='syn'><b>SYNTHETIC DATA</b> · Not real patient information.</p>" if synthetic else ""
    return f"""<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Audit · {e(dataset_id)}</title>
<style>
body{{margin:0;background:{c['canvas']};color:{c['text-primary']};font:14px/1.5 Inter,system-ui,sans-serif}}
main{{max-width:1100px;margin:0 auto;padding:32px 16px}}
h1{{font-size:24px;font-weight:600;margin:0 0 16px}} h2{{font-size:18px;margin:32px 0 8px}}
code{{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px}}
.syn{{border:2px solid {c['synthetic']};background:{c['surface']};padding:8px 12px;border-radius:4px}}
table{{width:100%;border-collapse:collapse;background:{c['surface']};border:1px solid {c['border']}}}
th{{text-align:left;background:{c['surface-subtle']};color:{c['text-secondary']};font-size:13px}}
th,td{{padding:6px 8px;border-bottom:1px solid {c['border']};vertical-align:top}} .num{{text-align:right;font-variant-numeric:tabular-nums}}
dl{{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;font-size:12px;color:{c['text-secondary']}}} dd{{margin:0;word-break:break-all}}
</style></head><body><main>
<h1>Dataset audit: {e(dataset_id)}</h1>{banner}
<p>Audit findings describe data quality only. They make no clinical claim. Blockers must be resolved, with the decision documented, before a split is frozen.</p>
<table><thead><tr><th>Severity</th><th>Check</th><th class="num">Count</th><th>Finding</th><th>Examples</th></tr></thead><tbody>{rows_html}</tbody></table>
<h2>Provenance</h2><dl>{prov}</dl>
</main></body></html>
"""


def write_reports(findings: list[Finding], out_dir: Path, stem: str, **meta) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    md = out_dir / f"{stem}.md"
    ht = out_dir / f"{stem}.html"
    md.write_text(render_markdown(findings, **meta), encoding="utf-8")
    ht.write_text(render_html(findings, **meta), encoding="utf-8")
    return md, ht
