# Miraflores · Tax workpaper

An evidence-first review workspace for the fictional Okafor–Lindqvist household's 2025 return. Built with React and TypeScript against the **unaltered supplied packet**: 74 documents, 3,012 extracted values, and three computed return versions.

This is an actively developed case-study prototype. It is not tax preparation software and does not recompute or file a return.

![Workspace overview](docs/images/overview.png)

The private GitHub repository is the source of truth. Development and testing happen locally; cloud hosting is deferred until the user considers the app finalized.

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
npx playwright install chromium
npm run test:e2e  # Browser workflow and mobile checks
npm run format:check  # Repository formatting
```

## Try the review loop

1. On **Return**, expand **Income → Total income → Total wages → Wages (Forms W-2, box 1)**. Parents stay visible and calculations expand in place.
2. Select the **D08 · W-2 · p. 1 · Box 1** source label. The evidence panel highlights `104,600.00` in the packet's printed content while the calculation stays visible. No verification action is required.
3. Expand **Issues to resolve → Same bank sweep interest counted twice** and inspect the two source records.
4. Search return calculations for `SchB.1.2`, expand it, and choose **Actions → Propose correction**. Enter $0, category `interest`, and a rationale. Estimated tax effects appear; engine totals remain unchanged.
5. Reload and open **History** to inspect the proposal, compare snapshots, view precomputed alternatives, or undo your own action. Export history for a portable record.
6. Final review sign-off is available to a reviewer or partner only after blocking warnings, manual flags, and outstanding correction proposals are cleared. Subsequent review events reopen it. This is a local review acknowledgment, not an e-signature or filing approval.

## What works today

- One white-background Return workspace with nested, collapsible calculations; Documents and History are secondary tools in the left sidebar.
- Inline calculation inputs, preserved expansion state, visible parent hierarchy, on-demand calculation details, and direct source labels attached to individual inputs.
- Evidence displayed beside the calculation on desktop and in a bottom panel on mobile; other document fields and reverse usage are collapsed by default.
- Search across all 627 current-version lines; large input lists load in batches with filtering.
- No routine verification forms: contextual flag, note, and correction actions open only on request. Existing verification records remain in history.
- Engine diagnostics plus independent duplicate-interest, FX-year, and W-2 source checks; assignment and documented resolution.
- Final, version-scoped review sign-off with blocker checks and conservative invalidation after any subsequent review event (including notes, assignments, and undo).
- Browser-local persistence, append-only history, undo, and JSON export with visible save errors.
- All three engine snapshots and five precomputed alternatives remain available.

## Deliberate limits

- **Local persistence:** reviews live in this browser's `localStorage`; there is no server, cross-device sync, or concurrent-user conflict handling. Export is available; import is not yet implemented.
- **Role simulation:** client-side restrictions are UX behavior, not secure authorization. The complete fictional packet is bundled, including fictional identifiers. Do not load real client data.
- **Review, not recalculation:** corrections are proposals. Estimates use manually selected packet rates and are not cumulative recomputed return totals. Currency, California sourcing, thresholds, credits, and QBI require review.
- **Filing is not implemented:** the final review sign-off is a local acknowledgment only. Client authorization, e-signatures, filing freezes, amendments, notices, and production retention controls remain future work. Later timeline events are labeled scripted scenario data.
- **Source fidelity:** the packet has no PDFs. Synthetic coordinates are not presented as real PDF coordinates. Ambiguous or absent text gets a field/page locator and a visible warning, not a fabricated highlight.
- **Coverage:** automated checks are intentionally narrow; no claim that every planted error has been found. Large schedules are browsable as return lines; dedicated asset/basis workspaces remain future work.

## Repository guide

| Path                                | Purpose                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| `CASE_STUDY.md`                     | Original employer brief                                                          |
| `okafor_lindqvist_2025_packet.json` | Original, immutable fixture; schema guide is its `readme` property               |
| `src/domain/`                       | Packet types, lineage graph, independent checks, review rules                    |
| `src/components/`                   | Calculation tree, evidence viewer, exception form, history, and issue components |
| `src/App.tsx`                       | Workspace screens and local review orchestration                                 |
| `tests/`                            | Lineage, check, permission, undo, and estimate regression tests                  |
| `docs/`                             | Architecture, findings, implementation decisions, and roadmap                    |
| `.github/workflows/ci.yml`          | Reproducible test/build checks                                                   |

## Submission notes

See [core idea and data model](docs/ARCHITECTURE.md), [findings](docs/FINDINGS.md), and [decisions and next steps](docs/DECISIONS.md). The applicant's recorded walkthrough and video link are still required by the case study.

AI assistance: OpenAI Codex helped inspect the fixture, design and implement the prototype, write documentation, and run validation. Human review and the applicant's own explanation of tradeoffs remain essential.
