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

Domain tests exercise real packet paths, version isolation, missing-reference behavior, cycle protection, independent checks, role restrictions, undo authorship, and estimate math. A production build checks browser compilation. Four Playwright browser tests pass for inline tracing and retained expansion, contextual evidence, correction persistence/undo, mobile layout and read-only roles, and final sign-off persistence/invalidation. Thirteen domain tests and the production build pass. The prior dependency audit reported zero known vulnerabilities; this revision adds no dependencies.

The app intentionally imports the full packet for the prototype. The production bundle is correspondingly large; a production data API or lazy-loaded packet can reduce initial JavaScript parsing costs.

## Local development and hosting decision

A private Sites project was reserved, and its non-secret identity is in `.openai/hosting.json`. Source synchronization and deployment were blocked by automatic approval review because Sites is a separate destination from the user-authorized private GitHub repository. No app source, build, or packet was uploaded to Sites. The user subsequently chose to build and test locally first and defer cloud hosting until the app is finalized. Continue committing and pushing milestones to the private GitHub repository; do not deploy during local development.

## UI revision: exception-driven review

The user explicitly requested fewer navigation destinations, inline collapsible calculations, contextual evidence, no routine per-number verification, one final sign-off, and a white background. These preferences override the original brief where they conflict.

**Deliberate departure from the employer brief:** the original asks to record how every number was verified. The revised design does not require those records. Inspection is frictionless; exceptions and final review acknowledgment are recorded. Legacy verification events are preserved without creating new ones through the UI.

The source document viewer remains simulated. Final sign-off certifies only the local review snapshot; it neither approves unresolved correction proposals nor claims an updated engine calculation. The app cannot reconcile a proposal into a newly computed engine result yet, so active proposals block sign-off until withdrawn; a future engine-import workflow must handle reconciliation.
