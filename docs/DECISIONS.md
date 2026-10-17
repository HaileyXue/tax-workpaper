# Implementation decisions and roadmap

## First milestone

The user's priority was a clean, employer-reviewable repository and a working tax-line-to-source interaction before expansion. The initial milestone delivered that loop with five supporting views. The subsequent UI revision consolidates it into one Return workspace, with Documents and History as secondary tools. It does not claim the full employer brief is complete.

| Decision                                      | Reason and tradeoff                                                                                                                             |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| React + TypeScript + Vite                     | Small, readable static application with typed domain logic and reproducible builds. No backend until the first review interaction is validated. |
| Preserve the packet at its supplied root path | Easy provenance comparison; no destructive migrations or invented replacement data.                                                             |
| Versioned local review event log              | Fast reproducible prototype, reload persistence, and explicit undo history. Not a secure multiuser audit store.                                 |
| Source text over synthetic PDF coordinates    | The packet's printed text is the evidence; coordinates are explicitly synthetic. Unique text highlights are honest and inspectable.             |
| Corrections remain proposals                  | The engine cannot be rerun. Overwriting totals would imply unsupported accuracy.                                                                |
| Explicit role simulation                      | Demonstrates action permissions while acknowledging that client-side state is not an authorization boundary. No production security claim.      |
| Narrow independent checks                     | Demonstrates that engine confidence is not proof without pretending to implement a complete tax engine.                                         |
| Scripted timeline labeled separately          | Future client signatures and e-file acceptance must not appear to be actual completed actions.                                                  |
| Private GitHub repository                     | User-requested publication target; meaningful implementation and validation commits.                                                            |

## Next milestones

1. Authenticated backend, durable event storage, server-enforced roles, sensitive-field redaction, evidence view logs, revision checks, and concurrent-session tests.
2. Stronger review dependencies: refine the conservative final-sign-off invalidation policy, enforce separation of preparation and approval, and require partner review for material adjustments.
3. Document disposition and completeness; independent reconciliation of payments, sales lots, business books, asset depreciation, basis, and carryovers.
4. Dedicated schedules for assets, state splits, K-1s, retirement/foreign items, rentals, deductions, and prior-preparer differences.
5. Assignments with deadlines, evidence attachments and client questions, notification delivery, bulk actions, and scenario comparison beyond tax deltas.
6. Filing state machine with client approval, e-signature integration, immutable filing snapshots, amendments, notice packages, and carryforward planning.
7. Hosted app link, applicant-recorded video, and final submission review.

## Validation approach

Domain tests exercise real packet paths, version isolation, missing-reference behavior, cycle protection, independent checks, role restrictions, undo authorship, and estimate math. A production build checks browser compilation. Six Playwright browser tests pass for inline tracing and retained expansion, contextual evidence, correction persistence/undo, mobile layout and read-only roles, and final sign-off persistence/invalidation. Twenty domain tests and the production build pass. The prior dependency audit reported zero known vulnerabilities; this revision adds no dependencies.

The app intentionally imports the full packet for the prototype. The production bundle is correspondingly large; a production data API or lazy-loaded packet can reduce initial JavaScript parsing costs.

## Local development and hosting decision

A private Sites project was reserved, and its non-secret identity is in `.openai/hosting.json`. Source synchronization and deployment were blocked by automatic approval review because Sites is a separate destination from the user-authorized private GitHub repository. No app source, build, or packet was uploaded to Sites. The user subsequently chose to build and test locally first and defer cloud hosting until the app is finalized. Continue committing and pushing milestones to the private GitHub repository; do not deploy during local development.

## UI revision: exception-driven review

The user explicitly requested fewer navigation destinations, inline collapsible calculations, contextual evidence, no routine per-number verification, one final sign-off, and a white background. These preferences override the original brief where they conflict.

**Deliberate departure from the employer brief:** the original asks to record how every number was verified. The revised design does not require those records. Inspection is frictionless; exceptions and final review acknowledgment are recorded. Legacy verification events are preserved without creating new ones through the UI.

The source document viewer remains simulated. Final sign-off certifies only the local review snapshot; it neither approves unresolved correction proposals nor claims an updated engine calculation. The app cannot reconcile a proposal into a newly computed engine result yet, so active proposals block sign-off until withdrawn; a future engine-import workflow must handle reconciliation.

## Readability refinement

Restored the left sidebar for Return, Documents, and History. The main canvas and sidebar are pure white, text is darker, and small labels are larger. Removed repeated form IDs from collapsed rows and placed rules, notes, and IDs in on-demand calculation details. Parent-child indentation and inline expansion still preserve context. Summary labels explicitly distinguish the federal balance due from the California refund. On narrow screens the sidebar becomes compact navigation above the content.

## Selective disclosure

Simple amounts display as plain rows with immediate source links. Disclosure controls are reserved for meaningful calculation breakdowns and source lists longer than three items. Explicit unchanged carry/sum steps are presented together, retaining the original graph and all intermediate rules and notes in the details menu. This removes unnecessary navigation without hiding meaningful transformations merely because their numeric results match.

## Reference screenshots: compact schedules

The screenshots clarified useful interaction choices: group related amounts by payer, compare federal and state figures, place exceptions beside affected rows, and retain the schedule while inspecting source evidence. They do not establish a working recalculation engine, authentic source PDFs, secure roles, or completed CPA review. No sample figures, clients, or review statuses from the screenshots are imported.

Summary, wages/interest, and dividend tables map to existing IDs in the selected packet version. All financial values resolve from that packet; missing mappings are shown as a dash, not zero. California total-income and allocation rows are distinguished explicitly. A calculation warning propagates forward to dependent amounts, not backward to every source it shares. No row is automatically marked reviewed or reconciled. The original packet remains unchanged; user-authored review events remain a separate local record.

The full calculation tree is available under one secondary disclosure. Source documents remain clearly labeled simulations of packet content; this revision does not invent PDF layouts or replace the supplied computed totals.
