# Case study requirements traceability

This document compares the requirements in [`ASSIGNMENT.md`](ASSIGNMENT.md) with the behavior currently implemented in the repository. It evaluates working behavior, not visual intent or data that merely exists in the JSON packet.

## Status definitions

<!-- prettier-ignore -->
| Status | Meaning |
| --- | --- |
| **Satisfied** | The requirement has a working end-to-end path for the supplied case. |
| **Partial** | A useful part works, but a material part of the stated requirement is missing. |
| **Not implemented** | The app does not provide the requested workflow. |

The current product is a strong review prototype, but it does **not** yet meet the brief's claim of “full workpaper capability.” Its most complete workflow is: identify an issue, follow its calculation path, inspect its simulated source, record a disposition or correction proposal, preserve the action in history, and gate final review sign-off.

## Evidence

<!-- prettier-ignore -->
| Requirement | Status | How the app satisfies it today | Function needed to close the gap |
| --- | --- | --- | --- |
| Trace any number to its exact source | **Satisfied for the supplied calculation graph** | All 627 lines in the current snapshot remain reachable from Return summary or Related return records. [`createGraph`](../src/domain/packet.ts) traverses inputs and sources; [`CalculationTree`](../src/components/CalculationTree.tsx) shows the path and direct evidence. Missing references remain visible instead of being silently discarded. | Production coverage should validate every imported packet and report orphaned or unresolved references before review begins. |
| Display the source document and identify the exact field or location | **Satisfied** | [`SourceViewer`](../src/components/SourceViewer.tsx) opens the simulated page, names the extracted field and page, and highlights the exact printed text only when the match is unique. It states when an exact highlight cannot be claimed. The panel can later accept a real PDF renderer without changing lineage IDs. | Replace the simulated text renderer with a PDF/image adapter while retaining document, page, field, and coordinate references. |
| Trace a document to everywhere it landed, or explain why it did not | **Partial** | The Documents tab shows `Where this document lands` using reverse graph edges. Superseded and unused documents are identified. For some unused documents, however, the app can only say that disposition needs review; it does not capture the actual reason. | Add a required `DocumentDisposition` record with statuses such as used, superseded, duplicate, irrelevant, wrong year, and pending, plus reason, actor, time, and replacement document. |
| Record how each number was verified | **Not implemented by current product decision** | The event model can retain legacy `verify` events, but the UI deliberately removed routine per-number verification. Only one final return sign-off is required. This is simpler, but it does not satisfy the literal case-study requirement. | Add risk-based verification: require a `VerificationRecord` only for material, low-confidence, changed, or policy-selected values. Store method, evidence references, reviewer, and time without putting a review form beside every clean number. |
| Link related items across the return, years, and related returns | **Partial** | Current-return lineage, prior-year pointers, agency records, assets, client records, and same-form related records can resolve through [`resolveReference`](../src/domain/packet.ts). There is no dedicated cross-year history or related-return workspace, and the packet contains only this household return. | Add a stable `SubjectIdentity` and `CrossPeriodLink` model that connects the same asset, entity, carryover, person, and election across years and separately filed returns. |
| Attach a file, message, or note as evidence | **Partial** | Users can add versioned notes to numbers and issues. Existing client communications in the packet can resolve as references. Users cannot upload files, attach an existing message, or create a question thread. | Add an `EvidenceAttachment` service for files, packet records, messages, and notes, with immutable hashes, access controls, and links to any calculation or decision. |

## Calculation

<!-- prettier-ignore -->
| Requirement | Status | How the app satisfies it today | Function needed to close the gap |
| --- | --- | --- | --- |
| Show how any number was built | **Partial** | The Return view shows a focused statement of immediate inputs and result, with a review path instead of infinitely nested cards. Redundant carry layers are collapsed only under tested rules, and audit details retain skipped lines. The interface intentionally hides internal engine rules, so some complex operations are not yet explained in plain accounting language. | Add typed calculation presentations for sums, limits, allocations, basis rollforwards, and comparisons. Each should explain the operation using supplied operands without exposing engine IDs or inventing a formula. |
| Reconcile figures that should agree | **Partial** | [`findIssues`](../src/domain/findings.ts) performs independent W-2 printed-box, duplicate-interest, and FX-year checks and preserves supplied diagnostics such as brokerage summary/detail mismatch. Coverage is intentionally narrow. | Build a declarative `ReconciliationRule` framework and add checks for payments, brokerage totals, depreciation, basis, books, carryovers, state allocations, and duplicated evidence. |
| Handle hundreds of sales and many assets without swamping review | **Partial** | Long calculation inputs are filtered and loaded in batches, so the general lineage view remains usable. There are no transaction-specific sales or asset review tables. | Add virtualized `SalesLotReview` and `AssetSchedule` views with grouping, exceptions-first filters, bulk evidence links, subtotal reconciliation, and drill-in to one item. |
| Take business books to taxable income | **Not implemented** | Business-related lines may be reachable in the graph, but there is no books-to-tax reconciliation workflow. Reachability alone is not a workpaper. | Add a `BooksToTaxBridge` showing book income, mapped adjustments, tax income, evidence, reviewer decisions, and a tie-out to the return line. |
| Split income between states | **Partial** | The summary displays federal and California figures, including California-source AGI and allocated taxable income, and users can trace their supplied inputs. There is no allocation workpaper showing residency periods, sourcing decisions, and reconciled totals. | Add a `StateAllocationWorkpaper` with income rows, federal total, state source, resident/nonresident periods, allocation method, decision evidence, and tie-outs to state lines. |
| Run checks that do not trust the engine | **Partial** | Three checks are computed independently from source text and graph relationships rather than accepting engine confidence or diagnostics. Regression tests prove the W-2 check can catch a high-confidence extraction error. | Expand the independent rule framework and label each result with its independently observed inputs, expected value, scope, and last execution time. |

## Change management

<!-- prettier-ignore -->
| Requirement | Status | How the app satisfies it today | Function needed to close the gap |
| --- | --- | --- | --- |
| Adjust without losing the original, including who, why, and tax effect | **Partial** | Correction proposals preserve the original and proposed values, actor, role, time, reason, snapshot, and estimated federal/California effects. They are append-only and do not overwrite the packet. They do not update the return calculation. | Add a `RecalculationAdapter` that sends accepted overrides to a tax engine or imports a newly computed snapshot, then records the proposal-to-result relationship and actual tax effect. |
| See changes live and what changed since the user's last visit | **Not implemented** | A save updates the current browser immediately, but the app has no last-seen marker, cross-session change feed, or concurrent updates. | Add server event streaming plus per-user `LastSeenCursor` records and a “Changes since your last visit” view. |
| Compare versions | **Satisfied** | History compares any supplied base snapshot with the selected snapshot and shows changed, added, and removed lines. Proposals remain clearly separate from engine snapshots. | Add grouped explanations and filters if the comparison grows beyond this case. |
| Try what-if scenarios | **Satisfied for supplied scenarios** | History displays all five precomputed alternatives and their supplied federal and California tax changes. It does not claim to calculate new scenarios. | A general scenario builder would require an engine API; it is outside what the supplied static packet can compute. |
| Act on many items at once, with undo | **Partial** | Users can undo their own active event by appending a compensating event. There is no bulk selection or bulk command. | Add a `BulkReviewCommand` that previews selected targets, validates role and snapshot, appends one atomic batch with child events, and supports batch undo. |

## Judgment and completeness

<!-- prettier-ignore -->
| Requirement | Status | How the app satisfies it today | Function needed to close the gap |
| --- | --- | --- | --- |
| Flag swings from last year | **Not implemented** | Prior-year references can be resolved, but the app does not calculate or prioritize year-over-year variances. | Add a `PriorYearVarianceCheck` with absolute and percentage thresholds, materiality policy, explanations, and links to both years' evidence. |
| Record judgment calls, elections, due diligence, and penalty decisions | **Partial** | Notes, flags, assignments, correction proposals, and approvals capture free-text judgment with actor and time. Supplied due-diligence diagnostics are retained. These are not structured records and do not distinguish an election from a penalty decision. | Add typed `JudgmentRecord` templates with decision, alternatives, authority/evidence, preparer, approver, effective years, revocability, and affected return lines. |
| Prove every document was considered | **Partial** | All 74 documents are indexed; use, supersession, reverse usage, and no-usage states are visible. Unused documents do not yet require final disposition. | Add a document completeness ledger that prevents final sign-off until every document has a reviewed disposition. |
| Prove every return area was considered | **Not implemented** | Every calculation line is reachable, but there is no area-level applicability checklist or required review standard. | Add an `AreaCompletenessChecklist` generated from household facts, packet contents, and firm standards, with applicable/not-applicable decisions and evidence. |
| Identify every outside filing | **Not implemented** | Some filing questions exist among Related return records, but no outside-filing inventory or disposition workflow exists. | Add an `OutsideFilingRegister` for FBAR, information returns, state/local filings, extensions, responsible person, due date, status, and evidence. |

## People and review workflow

<!-- prettier-ignore -->
| Requirement | Status | How the app satisfies it today | Function needed to close the gap |
| --- | --- | --- | --- |
| Ask clients or colleagues questions that become evidence | **Partial** | Supplied client questionnaire answers and messages can be referenced. The app cannot create, send, receive, or attach a new question thread. | Add `QuestionThread` records linked to workpaper targets, with participants, messages, attachments, due date, answer status, and final evidence designation. |
| Let review notes block filing | **Partial** | Open warnings, reviewer flags, and correction proposals block local final review sign-off. There is no filing function to block. | Introduce explicit blocking severity and make a future filing transition require a valid review sign-off with zero active blockers. |
| Reopen sign-offs when signed information changes | **Satisfied in the local event model** | A later review event, including an undo, invalidates the version-scoped sign-off. This behavior is covered by domain and browser tests. | Move the same invariant to a transactional server so it cannot be bypassed by another client. |
| Enforce roles | **Partial** | Preparer, reviewer, partner, and read-only behavior changes actions in the UI; only reviewer/partner can resolve findings or sign off. Enforcement is entirely client-side and the role switcher simulates identity. | Add authenticated users, server authorization, sensitive-data clearance checks, and immutable actor identity. |
| Support several people at once | **Not implemented** | Browser-local storage has no synchronization or conflict handling. | Add a server event store, optimistic concurrency, presence, live updates, and conflict resolution for concurrent edits. |
| Assignments, deadlines, and notifications | **Partial** | Issues can be assigned to supplied staff. Deadlines, personal queues, and notifications are absent. | Add structured assignments with assignee ID, due date, status, reminders, `My work`, and `Awaiting my review` queues. |
| Client approval and e-file signature | **Not implemented** | No client portal, approval, identity verification, or signature workflow exists. | Add a client approval package and compliant e-signature integration tied to the exact frozen return artifact. |

## Filing and after-filing work

<!-- prettier-ignore -->
| Requirement | Status | How the app satisfies it today | Function needed to close the gap |
| --- | --- | --- | --- |
| Manage extensions, filing, rejections, and the client's copy | **Not implemented** | The Case timeline stops at the latest return snapshot. Later scripted packet events are intentionally omitted because the app performs no filing action. | Add a `FilingCase` state machine with extension records, submission receipts, acknowledgments, rejection resolution, delivery tracking, and immutable client-copy artifacts before exposing later events. |
| Freeze at filing and amend on top | **Not implemented** | Return snapshots are immutable, but there is no filing freeze or amendment relationship. | Add a cryptographically identified `FiledSnapshot` and an `AmendmentLayer` that references the filed base and records changed facts, calculations, approvals, and filings. |
| Answer a notice with a self-contained record | **Not implemented** | Existing evidence and history can be exported, but there is no notice matter or response package. | Add a `NoticeMatter` workspace that snapshots relevant return lines, documents, correspondence, decisions, deadlines, response versions, and proof of delivery. |
| Carry everything forward with history and plan next year | **Partial** | History is append-only in one browser, and prior-year/carryforward records can appear in lineage or Related return records. There is no rollover process or next-year planning workflow. | Add a `CarryforwardLedger` with source year, opening balance, activity, closing balance, expiration, next action, and links to the new year's imported case. |

## Firm operations

<!-- prettier-ignore -->
| Requirement | Status | How the app satisfies it today | Function needed to close the gap |
| --- | --- | --- | --- |
| Firm-wide standards | **Not implemented** | Starter standards exist in the JSON but are not applied as configurable review policy. | Add versioned `FirmPolicy` templates that generate required checks and sign-offs by return type, risk, and office, with controlled exceptions. |
| Protect sensitive data and keep view logs | **Not implemented** | The app uses fictional data and makes no production security claim. The full packet is bundled in the client and document views are not logged. | Add encrypted server storage, least-privilege authorization, field redaction, download controls, retention policy, and an append-only evidence access log. |
| Track time against budget | **Not implemented** | No time or budget data is captured. | Add case budgets, time entries, phase/task codes, actual-versus-budget reporting, and permissioned adjustments. |
| Firm status and search | **Partial** | A Cases landing page shows the supplied case and its live issue count. Documents can be searched and filtered. There is only one case and no firm-wide client, return, task, or evidence search. | Add a server-backed case index with workflow status, owners, deadlines, facets, permissions-aware full-text search, and saved views. |

## Records a CPA expects

The JSON may contain data related to a record below. This table marks a record as satisfied only when the app gives it a usable workpaper presentation and review workflow; raw reachability does not count as completion.

<!-- prettier-ignore -->
| Expected record | Status | Current coverage | Function needed to close the gap |
| --- | --- | --- | --- |
| Return summary vs last year | **Partial** | The current federal/California summary and supplied-version comparison work. There is no prior-year summary column or variance explanation. | Add prior-year values, change amounts/percentages, materiality flags, and reviewer explanations to the summary. |
| Tax computation | **Partial** | Tax lines and their inputs are reachable, but complex rate, limit, and credit mechanics lack tailored explanations. | Add a tax-computation view with typed operations and tie-outs to supplied totals. |
| Area summaries | **Partial** | Same-form related records and calculation paths provide access, but they are not curated summaries for wages, investments, business, rentals, and other areas. | Add packet-derived subject mappings and area headers with totals, issues, documents, decisions, and sign-off state. |
| Document index | **Satisfied** | Documents lists all 74 records, supports title/issuer search and owner/uploader filters, highlights the open document, shows snapshot usage, and opens page-level evidence. | Add final disposition and completeness status as described above. |
| Depreciation by asset | **Not implemented** | Asset references can resolve, but no per-asset schedule presents method, life, bonus, federal/California/AMT differences, disposals, or recapture. | Build `AssetSchedule` with jurisdiction columns, annual rollforward, disposition/recapture detail, evidence, and tie-outs. |
| Sales detail | **Partial** | Brokerage and crypto amounts can be traced, and supplied mismatches surface as issues. There is no scalable lot table or proceeds/basis reconciliation. | Build `SalesLotReview` with grouped lots, term, proceeds, basis, adjustments, source links, exception filters, and subtotal tie-outs. |
| Books to tax | **Not implemented** | No dedicated record. | Build the `BooksToTaxBridge` described above. |
| Rentals and passive losses | **Partial** | Relevant supplied lines remain reachable, but there is no property-level income/expense, disposition, or passive-loss rollforward. | Add a rental workpaper by property with activity, depreciation, basis, disposition, passive limits, carryover, and return tie-outs. |
| K-1 lines | **Partial** | K-1 source and calculation lines are reachable, but there is no entity/box-level comparison, late-K-1 state, or basis linkage. | Add a K-1 workpaper by entity and box, including version/correction status, basis/at-risk/passive links, state data, and tie-outs. |
| Retirement and foreign items | **Partial** | Related lines, Swedish evidence, FX parameters, and the wrong-year FX issue are accessible. There is no dedicated retirement-basis or foreign-reporting checklist. | Add IRA basis/conversion rollforwards and foreign account/income workpapers linked to filing requirements and FX evidence. |
| Deductions and credits with limits | **Partial** | Summary totals and underlying lines are reachable. Limit computations lack a purpose-built presentation. | Add deduction/credit schedules showing eligible amount, limitation inputs, allowed amount, carryover, and jurisdiction differences. |
| Payments | **Partial** | Withholding and total payments appear in the summary and trace to calculations. There is no payment reconciliation against agency records and source documents. | Add a payment ledger for withholding, estimates, extensions, carryforwards, agency matches, and return tie-outs. |
| State split | **Partial** | Key California totals are shown and traceable. | Build the `StateAllocationWorkpaper` described above. |
| Carryovers | **Partial** | Carryforward lines remain accessible under Related return records, but there is no multi-year rollforward or completeness control. | Build the `CarryforwardLedger` described above. |
| Basis by year | **Not implemented** | Basis-related lines may be reachable, but there is no year-by-year owner/entity/asset ledger. | Add a basis rollforward with opening balance, contributions, income, distributions, losses, limitations, closing balance, and source-year links. |
| Prior preparer work vs current changes | **Not implemented** | Supplied return snapshots can be compared, but the app does not identify which values came from the prior preparer or distinguish their methods from current-firm decisions. | Add provenance for imported prior work, current-firm adoption/change decisions, reasons, and effects by record. |

## Deliverables

<!-- prettier-ignore -->
| Deliverable | Status | Evidence and remaining work |
| --- | --- | --- |
| Working web app from a link, loading the packet, saving work, with a role switcher | **Partial** | The React/TypeScript app loads the unaltered packet, runs locally, saves review events to `localStorage`, exports history, and has a role switcher. It is not hosted yet by explicit project decision, and its saves and roles are prototype-only. A private deployment is still required for submission. |
| One page on the core idea and data model | **Satisfied** | [`ARCHITECTURE.md`](ARCHITECTURE.md) explains the evidence, immutable snapshot, and human-event model. |
| Errors found and how the design surfaced them | **Satisfied** | [`FINDINGS.md`](FINDINGS.md) separates packet findings, independent checks, supplied diagnostics, and limitations. |
| Recorded walkthrough with technical decisions and tradeoffs; video link | **Not implemented** | No recording or video link exists. Record the final app, demonstrate the review loop, explain architecture and deliberate limits, and add the link to the README. |
| Disclose tool use, including AI | **Satisfied** | The README states that OpenAI Codex assisted with packet inspection, design, implementation, documentation, and validation. |

## Selected implementation scope

Trying to implement every missing item would produce many shallow screens and weaken the strongest part of the prototype. The remaining build should use four tests:

1. Does it help a CPA decide whether this return is supportable?
2. Does the supplied packet contain enough data to implement it honestly?
3. Does it demonstrate a hard product problem rather than routine administration?
4. Can it become a complete, testable workflow before the submission is finalized?

For the hiring submission, one outcome has priority over the four area improvements below.

### Priority 0 — Complete one source-to-decision lifecycle

Demonstrate a real supplied case transition from an open issue through new evidence, a new engine snapshot, explained calculation changes, reviewer disposition, and updated sign-off state. Use the late K-1 transition from v2 to v3 because the packet supplies both snapshots and the triggering documents.

The workflow should:

- start in v2 with the missing K-1 and incomplete S-corporation basis diagnostics;
- show the affected records and what evidence is missing;
- replay the supplied document-arrival event without pretending to contact a client or run a tax engine;
- advance to the immutable supplied v3 snapshot and record that handoff in review history;
- group the 89 changed lines into new direct inputs, downstream calculations, payments, and return totals;
- show that the missing-K-1 and incomplete-basis diagnostics cleared while unrelated issues remain open;
- trace the new values to their exact supplied source documents;
- preserve an honest final state: the reviewed issue is complete, but remaining blockers still prevent return sign-off.

**Why this comes first:** it proves that lineage, documents, issues, versions, people, and audit history operate as one system. It also demonstrates the core engineering idea—using a provenance graph to explain the impact of new evidence—more clearly than another standalone screen.

The transition must be labeled as a replay of supplied scenario data. No client message, AI conclusion, engine execution, or tax result may be invented.

After that lifecycle works, the following four product improvements have the highest priority.

### Priority 1 — Investment sales review workpaper

Build a scalable `SalesLotReview` inside the return-first workspace. The selected snapshot contains 302 Form 8949 lines, or 48.2% of all 627 calculation lines. This is the clearest place to prove that the design can handle large detail without overwhelming a reviewer.

The workpaper should:

- use only supplied sale lines and their source relationships;
- group and subtotal by packet-supported brokerage, asset class, term, or source document;
- show proceeds, basis, adjustments, and gain or loss when those values are supplied;
- prioritize missing basis, source/detail mismatches, corrected documents, and questionnaire conflicts;
- reconcile displayed subtotals to supplied Schedule D/Form 8949 totals;
- retain issue actions and the resizable source-document panel.

**Why first:** it covers nearly half the current calculation graph, addresses the brief's explicit “hundreds of sales” challenge, and brings several real packet issues into one demonstrable workflow. A strong sales workpaper is more valuable than adding several low-detail area pages.

### Priority 2 — Completeness and document disposition

Add a `CompletenessLedger` that combines document disposition, return-area consideration, and outside-filing identification. Final sign-off should require every supplied document and applicable area to have a disposition, while clean numbers should remain free of routine review forms.

The ledger should:

- classify each of the 74 documents as used, superseded, duplicate, irrelevant, wrong year, or pending;
- require a reason, actor, time, and replacement link where applicable;
- derive an initial area inventory from supplied forms, household facts, firm starter standards, and diagnostics;
- track applicable, not applicable, complete, and blocked states;
- surface supplied outside-return items such as FBAR and information-return questions;
- require targeted verification only for risky, changed, low-confidence, or policy-selected evidence.

**Why second:** lineage proves where known numbers came from; completeness proves that nothing important was silently omitted. That is the largest remaining gap in the workpaper's core promise and makes final sign-off materially more trustworthy.

### Priority 3 — Clear calculation explanations and independent reconciliations

Extend the current focused calculation statement with typed presentations for operations the packet supports unambiguously: totals, comparisons, allocations, limitations, and rollforwards. Pair those presentations with a small set of high-value independent checks.

The improvement should:

- explain the relationship between inputs and result in accounting language without displaying engine IDs;
- never infer an operator from coincidentally equal values or vague rule text;
- reconcile sales subtotals, payments, document totals, and selected prior-year changes where the packet supplies both sides;
- show the independently observed amount, expected amount, difference, evidence, and scope;
- keep issue navigation attached to the exact source and affected calculation chain.

**Why third:** source links alone do not explain a calculation. This improves the signature interaction throughout the app and strengthens trust without pretending the frontend can rerun the tax engine.

### Priority 4 — California part-year allocation workpaper

Build a `StateAllocationWorkpaper` from the 30 supplied Schedule CA (540NR) lines, 19 Form 540NR lines, and their evidence relationships.

The workpaper should:

- show federal or total income beside California-source amounts when both are supplied;
- distinguish residency/allocation inputs, adjustments, and calculated state outputs;
- explain the tie from source categories to California-source AGI and allocated taxable income;
- highlight unresolved sourcing decisions and the supplied California AMT warning;
- link every displayed amount back to the existing calculation and evidence panel.

**Why fourth:** the California-to-Texas move is one of the case's defining complexities. This workpaper demonstrates that the design can present jurisdiction-specific reasoning rather than only federal totals, while remaining fully grounded in supplied data.

### Submission work after the end-to-end lifecycle

Once the source-to-decision lifecycle is stable, deploy the private preview, record the walkthrough, and add the video link. These are mandatory deliverables and should not wait for all four follow-on improvements. The video should lead with the end-to-end lifecycle, then show the strongest completed follow-on work rather than touring every screen.

## Intentionally deferred requirements

The following are valid production requirements but are poor uses of the remaining case-study time:

- **Recalculation and arbitrary what-if modeling:** the packet contains immutable computed snapshots and five alternatives, not a callable tax engine. The app should continue to label corrections as proposals.
- **Production authentication, concurrent editing, access logs, and encrypted storage:** these require a backend and security program. The current role switcher is enough to demonstrate workflow roles, provided its limits remain explicit.
- **E-filing, client signatures, extensions, amendments, and notice response:** these depend on external systems and regulated operational processes. Scripted timeline data must not be presented as working filing functionality.
- **Firm timekeeping, budgets, and global search:** the packet represents one case, so these features would be mostly invented scaffolding.
- **Full custom workpapers for every remaining tax area:** depreciation, rentals, K-1s, basis, retirement, foreign reporting, deductions, credits, and carryovers should remain traceable through the central view. Build another specialized workpaper only if the four priorities finish with enough time for the same level of depth.
- **Messaging, attachments, deadlines, notifications, and bulk administration:** useful collaboration features, but less important than proving the return's evidence, completeness, large-detail review, and state allocation.

## Verification evidence

The current automated suite covers graph traversal, reverse document usage, reference resolution, packet-only mappings, independent checks, permission rules, correction estimates, undo, sign-off invalidation, complete current-version line reachability, issue-to-source navigation, simulated evidence, responsive behavior, and evidence-panel resizing. See [`tests/domain.test.ts`](../tests/domain.test.ts) and [`tests/browser/review.spec.ts`](../tests/browser/review.spec.ts).

Automated coverage proves those implemented behaviors; it does not prove tax-law correctness, completeness of planted-error detection, production security, or CPA usability. Those remain explicit validation tasks.
