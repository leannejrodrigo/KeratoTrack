# Licensing

## Original project code

The original code and documentation written for KeratoTrack are released under
the [MIT licence](../LICENSE).

## What the MIT licence does not cover

The MIT licence applies only to work created for this project. It does **not**
grant any rights over:

| Material | Licensed by | Notes |
|---|---|---|
| Research datasets | Their original authors | Never stored in or distributed through this repository. Each dataset's own licence, recorded for the exact version used, governs its use. See [research-protocol.md](research-protocol.md), section 10. |
| Fonts | Their font authors | Inter and JetBrains Mono are planned, both under the SIL Open Font License 1.1. Their licence files will be included alongside the font files when they are added. |
| Third-party libraries | Their own authors | Installed through package managers under their own licences. They are listed in each component's dependency file once installed. |
| Figures or text from published papers | Their publishers or authors | Need their own permission. A dataset's licence and a paper's licence are separate. |

Using KeratoTrack's code under the MIT licence gives no right to obtain,
redistribute or use any research dataset. Anyone reproducing the research must
obtain each dataset from its original source and follow its terms.

## Third-party components currently included

No third-party files are committed to this repository. Third-party packages
are installed by package managers and listed in `companion/package.json` and
`research/pyproject.toml`; the reasons are in
[ADR 0009](decisions/0009-first-libraries.md).

| Component | Licence | Notes |
|---|---|---|
| Inter (via `@fontsource-variable/inter`) | SIL OFL 1.1 | Bundled into the Companion's build output. Any distributed build must include the OFL text, which ships in the package (`node_modules/@fontsource-variable/inter/LICENSE`) |
| JetBrains Mono (via `@fontsource/jetbrains-mono`) | SIL OFL 1.1 | As above |

This section is updated whenever third-party material is added.
