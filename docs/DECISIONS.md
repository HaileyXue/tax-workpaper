# Implementation decisions and roadmap

## Current product model

**Tax workpaper** opens on Cases. The delivered packet contains one reviewable household; related returns without their own packet are not invented as available cases. The issue count uses the latest supplied engine version plus saved review events. Reloading returns to Cases without discarding those events.

Return contains one unified summary: federal/California totals, expandable supporting calculations, search, and other return records. Documents and History remain secondary tools in the left sidebar. The canvas is white with dark text, green controls, and amber issues. Source evidence stays beside the calculation in a resizable panel on desktop and a full-width bottom panel on mobile.

The issues banner contains direct links, not nested calculations or forms. Clicking an issue finds its actual dependency path, reveals the path within Summary, and smoothly scrolls to the source. Reduced-motion preferences use immediate scrolling. Assignment and resolution are available beside that calculation. Correction proposals remain proposals and link to History for withdrawal; they cannot be resolved into an invented engine result.

Highlights follow the source and affected downstream amounts. Unrelated inputs remain unhighlighted. Highlighting indicates a dependency on an unresolved issue, not proof that every highlighted value is incorrect. Resolved findings are excluded, while active reviewer flags remain included.

## Why one summary can contain the supporting records

A schedule is a supporting calculation or list; it is not a requirement to create a separate page. The [IRS describes Schedule B](https://www.irs.gov/forms-pubs/about-schedule-b-form-1040) as supporting interest and ordinary dividend reporting. That accounting distinction supports a hierarchy from totals to details, not the earlier choice to place Wages & interest and Dividends beside Summary as peer tabs.

Earlier iterations used those payer tables and a separate full calculation index. The current implementation removes that duplicated navigation. In v3, 51 of 627 lines lie outside the displayed totals' dependency graph, including carried-forward IRA basis, ending S-corporation stock basis, and required-1099 questions. These remain accessible in Summary under Other return records and through search. Coverage tests ensure every line remains reachable. Questionnaire issues without numeric links navigate to their actual record instead of a fabricated number.

## Technical decisions and limits

| Decision                                            | Reason and tradeoff                                                                                                                                                                             |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React + TypeScript + Vite                           | Small local application with isolated domain logic and reproducible builds.                                                                                                                     |
| Immutable supplied JSON                             | Every financial figure and dependency comes from the packet. Missing figures remain absent, not zero.                                                                                           |
| Engine snapshots remain read-only                   | The engine cannot be rerun; corrections and estimated impacts do not replace return totals.                                                                                                     |
| Browser-local append-only review log                | Reproducible persistence, attribution, and undo; not secure multiuser storage.                                                                                                                  |
| Source text instead of invented PDFs                | The packet supplies printed page text. Only unique exact matches receive source highlights; ambiguous locations remain explicit.                                                                |
| Client-side role switcher                           | Demonstrates permissions, but is not a production authorization boundary.                                                                                                                       |
| Selective expansion                                 | Simple source-backed numbers remain plain rows; real calculations and long lists expand. Unchanged carry/sum steps retain their full lineage in details.                                        |
| No routine per-value verification                   | User-requested exception-driven review with one final acknowledgment. This deliberately departs from the employer brief's per-number verification requirement; legacy records remain preserved. |
| Conservative sign-off invalidation                  | Any later review event reopens sign-off. Filing approval, e-signatures, and production retention are not implemented.                                                                           |
| Scripted timeline distinguished from actual actions | Supplied future filing events are scenario data, not evidence that the prototype filed a return.                                                                                                |

The static prototype bundles the complete fictional packet, resulting in a large JavaScript bundle. A production API or lazy-loaded packet would improve initial loading and enforce access boundaries. CPA usability has not been validated with a practicing reviewer.

## Validation

Twenty-two domain tests cover lineage, independent checks, version isolation, review permissions, estimates, and complete summary coverage. Nine browser tests cover issue-to-source navigation, long paths, nonnumeric records, correction persistence/undo, contextual resolution, sign-off, resizing, mobile layout, and read-only roles. TypeScript, the production build, and repository formatting checks pass. Browser workflow tests block external font requests so network latency cannot stall local navigation. This revision introduces no dependencies.

## Hosting and repository

Development and testing remain local. Meaningful milestones are committed and pushed to the user-authorized private GitHub repository. Cloud hosting is deferred until finalization. A Sites project was previously reserved (`.openai/hosting.json`), but source synchronization was blocked and no source, packet, or build was uploaded there.

## Remaining milestones

1. Authenticated backend, durable event storage, server-enforced roles, evidence access logs, redaction, and concurrent-session handling.
2. Document completeness and independent reconciliation of payments, sales lots, books, depreciation, basis, and carryovers.
3. Rich asset, rental, K-1, state-split, retirement, and deduction editing where supported by the data; explicit arithmetic displays only where operators are unambiguous.
4. Evidence attachments, client questions, deadlines, notifications, and bulk actions.
5. Engine-result import to reconcile correction proposals; stronger final approval dependencies and separation of duties.
6. Client authorization, e-signatures, filing freezes, amendments, notice packages, and carryforward planning.
7. Hosted submission link, applicant-recorded walkthrough video, and final review.
