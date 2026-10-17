# Miraflores · Tax workpaper

An evidence-first review workspace for the fictional Okafor–Lindqvist household's 2025 return. Built with React and TypeScript against the **unaltered supplied packet**: 74 documents, 3,012 extracted values, and three computed return versions.

This is an actively developed case-study prototype. It is not tax preparation software and does not recompute or file a return.

## Run locally

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. For validation:

```sh
npm run check  # TypeScript and domain tests
npm run build  # Production bundle
```

## Try the complete review loop

1. Open **Overview → Trace wages to the W-2s**.
2. Select `ev-0016`. Inspect D08, page 1, Box 1: the viewer highlights `104,600.00` in the packet's **printed content**, alongside the extracted value and its confidence.
3. Record a verification with a method and evidence note. Refresh; the review remains saved.
4. Open **Review queue → Same bank sweep interest counted twice**. Follow `ev-0492` and `ev-0538` to D28 and D29 and inspect their downstream tax lines.
5. On `SchB.1.2`, propose a correction from $1,840 to $0 with category `interest` and a rationale. The app shows the supplied marginal-rate estimate; engine totals stay unchanged.
6. Assign the finding and record a reviewer resolution. Inspect **Changes & filing** for the event history, version differences, and precomputed alternatives. Undo your own action with a compensating record.
7. Export the review history as JSON for a portable record of the session.

## What works today

- Five connected screens: overview, review queue, number explorer, evidence library, changes & filing.
- Recursive tax-line lineage, reverse document usage, and explicit unresolved-reference states.
- Simulated documents rendered from printed source content, with page selection, field locators, and exact unique-text highlights.
- Engine diagnostics plus independent duplicate-interest, FX-year, and W-2 source checks.
- Version-scoped verification, flags, proposed adjustments, assignment, resolution, and append-only undo history.
- Browser-local persistence and JSON export, with storage errors surfaced instead of silent saves.
- Staff role switcher with basic action permissions; all three snapshots and all five supplied alternatives.

## Deliberate limits

- **Local persistence:** reviews live in this browser's `localStorage`; there is no server, cross-device sync, or concurrent-user conflict handling. Export is available; import is not yet implemented.
- **Role simulation:** client-side restrictions are UX behavior, not secure authorization. The complete fictional packet is bundled, including fictional identifiers. Do not load real client data.
- **Review, not recalculation:** corrections are proposals. Estimates use manually selected packet rates and are not cumulative recomputed return totals. Currency, California sourcing, thresholds, credits, and QBI require review.
- **Filing is not implemented:** approvals, signatures, filing freezes, amendments, notices, and production retention controls remain future work. Later timeline events are labeled scripted scenario data.
- **Source fidelity:** the packet has no PDFs. Synthetic coordinates are not presented as real PDF coordinates. Ambiguous or absent text gets a field/page locator and a visible warning, not a fabricated highlight.
- **Coverage:** automated checks are intentionally narrow; no claim that every planted error has been found. Large schedules are browsable as return lines; dedicated asset/basis workspaces remain future work.

## Repository guide

| Path                                | Purpose                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| `CASE_STUDY.md`                     | Original employer brief                                            |
| `okafor_lindqvist_2025_packet.json` | Original, immutable fixture; schema guide is its `readme` property |
| `src/domain/`                       | Packet types, lineage graph, independent checks, review rules      |
| `src/components/`                   | Source viewer and review form                                      |
| `src/App.tsx`                       | Workspace screens and local review orchestration                   |
| `tests/`                            | Lineage, check, permission, undo, and estimate regression tests    |
| `docs/`                             | Architecture, findings, implementation decisions, and roadmap      |
| `.github/workflows/ci.yml`          | Reproducible test/build checks                                     |

## Submission notes

See [core idea and data model](docs/ARCHITECTURE.md), [findings](docs/FINDINGS.md), and [decisions and next steps](docs/DECISIONS.md). The applicant's recorded walkthrough and video link are still required by the case study.

AI assistance: OpenAI Codex helped inspect the fixture, design and implement the prototype, write documentation, and run validation. Human review and the applicant's own explanation of tradeoffs remain essential.
