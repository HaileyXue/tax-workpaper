# Implementation decisions and roadmap

This is the canonical, living decision log for this repository. Record important product and technical decisions here as work proceeds, including the reason, alternatives, tradeoffs, and implementation status. Preserve earlier decisions when direction changes: mark them superseded and link to the replacement rather than erasing the reasoning. A proposal is not an implemented feature or an approved requirement.

The sections below describe the current implementation. The dated decision records at the end preserve the reasoning and pending proposals.

## Current product model

**Tax workpaper** opens on Cases. The delivered packet contains one reviewable household; related returns without their own packet are not invented as available cases. The issue count uses the latest supplied engine version plus saved review events. Reloading returns to Cases without discarding those events.

Return contains one unified summary: federal/California totals, focused supporting calculations and related return records. Documents and History remain secondary tools in the left sidebar. The canvas is white with dark text, green controls, and amber issues. Source evidence stays beside the calculation in a resizable panel on desktop and a full-width bottom panel on mobile.

The Issues tab contains direct links, not nested calculations or forms. Clicking an issue switches to Return, finds its actual dependency path, reveals the path within Summary, and smoothly scrolls to the source. Reduced-motion preferences use immediate scrolling. Assignment and resolution are available beside that calculation. Correction proposals remain proposals and link to History for withdrawal; they cannot be resolved into an invented engine result.

Highlights follow the source and affected downstream amounts. Unrelated inputs remain unhighlighted. Highlighting indicates a dependency on an unresolved issue, not proof that every highlighted value is incorrect. Resolved findings are excluded, while active reviewer flags remain included.

## Why one summary can contain the supporting records

A schedule is a supporting calculation or list; it is not a requirement to create a separate page. The [IRS describes Schedule B](https://www.irs.gov/forms-pubs/about-schedule-b-form-1040) as supporting interest and ordinary dividend reporting. That accounting distinction supports a hierarchy from totals to details, not the earlier choice to place Wages & interest and Dividends beside Summary as peer tabs.

Earlier iterations used those payer tables and a separate full calculation index. The current implementation removes that duplicated navigation. In v3, 51 of 627 lines lie outside the displayed totals' dependency graph, including carried-forward IRA basis, ending S-corporation stock basis, and required-1099 questions. These remain accessible in Summary under Related return records. Coverage tests ensure every line remains reachable. Questionnaire issues without numeric links navigate to their actual record instead of a fabricated number.

## Technical decisions and limits

| Decision                                            | Reason and tradeoff                                                                                                                                                                             |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React + TypeScript + Vite                           | Small local application with isolated domain logic and reproducible builds.                                                                                                                     |
| Immutable supplied JSON                             | Every financial figure and dependency comes from the packet. Missing figures remain absent, not zero.                                                                                           |
| Engine snapshots remain read-only                   | The engine cannot be rerun; corrections and estimated impacts do not replace return totals.                                                                                                     |
| Browser-local append-only review log                | Reproducible persistence, attribution, and undo; not secure multiuser storage.                                                                                                                  |
| Source text instead of invented PDFs                | The packet supplies printed page text. Only unique exact matches receive source highlights; ambiguous locations remain explicit.                                                                |
| Client-side role switcher                           | Demonstrates permissions, but is not a production authorization boundary.                                                                                                                       |
| Focused calculation statements                      | One breakdown at a time, with a review trail and aligned inputs/result. This sacrifices simultaneous visibility of every depth for readability.                                                 |
| No routine per-value verification                   | User-requested exception-driven review with one final acknowledgment. This deliberately departs from the employer brief's per-number verification requirement; legacy records remain preserved. |
| Conservative sign-off invalidation                  | Any later review event reopens sign-off. Filing approval, e-signatures, and production retention are not implemented.                                                                           |
| Scripted timeline distinguished from actual actions | Supplied future filing events are scenario data, not evidence that the prototype filed a return.                                                                                                |

Internal calculation IDs and engine-reference rule text are not rendered in the interface, including action menus, dialogs, history targets, and accessible labels. Document IDs remain prominent as requested. The focused breakdown shows supplied inputs and amounts without inventing operations. Rules remain internal; professionally worded explanations of complex limits and allocations remain a future improvement.

The static prototype bundles the complete fictional packet, resulting in a large JavaScript bundle. A production API or lazy-loaded packet would improve initial loading and enforce access boundaries. CPA usability has not been validated with a practicing reviewer.

## Validation

Twenty-two domain tests cover lineage, independent checks, version isolation, review permissions, estimates, and complete summary coverage. Fourteen browser tests cover issue-to-source navigation, long paths, nonnumeric records, correction persistence/undo, contextual resolution, sign-off, resizing, mobile layout, read-only roles, and snapshot-dependent document status. TypeScript, the production build, and repository formatting checks pass. Browser workflow tests block external font requests so network latency cannot stall local navigation. This revision introduces no dependencies.

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

## Dated decision records

The initial entries were reconstructed from the project conversation on 2026-10-17. Commit references identify implementation milestones where available, not the exact time every preference was first expressed.

### D01 — Preserve the delivered data and distinguish review from calculation

- **Recorded:** 2026-10-17. **Status:** Implemented; ongoing constraint.
- **Decision:** Preserve the original JSON. Display its supplied figures and versions, and store authored review actions separately. Do not copy sample figures from reference screenshots, create fictional extra cases, or imply the engine can recompute the return.
- **Reason:** The packet is the authoritative case input and contains intentional mistakes. Its provenance must survive CPA review.
- **Tradeoff:** Corrections remain proposals; estimated impacts are not replacement return totals. Missing information stays missing.
- **Alternative rejected:** Editable totals that appear to regenerate the return without an available engine.

### D02 — One central, return-first workspace

- **Recorded:** 2026-10-17. **Status:** Implemented; central-view preference retained. Reference: `1e4048a`.
- **Decision:** Use Summary as the central entry point to calculations and evidence. Keep the Cases landing page and secondary Documents/History tools. Remove separate Number Explorer navigation, peer payer-schedule tabs, and the duplicated All calculations & schedules container.
- **Reason:** The user repeatedly found multiple destinations and deep navigation disorienting. Return-first describes the starting point, not a restriction to records reachable from displayed totals.
- **Tradeoff:** The interface must deliberately expose records without arithmetic paths to those totals. Coverage cannot depend solely on traversing the calculation graph.
- **Alternative considered:** Topic-first, with Employment, Investments, Business, etc. as the primary navigation. That gives nonnumeric records natural homes, but changes the user's preferred starting point. Topic membership can still support the central return-first view.
- **Accounting distinction:** Supporting schedules and source evidence have different roles, but those roles do not require separate application pages.

### D03 — Review exceptions and sign off once

- **Recorded:** 2026-10-17. **Status:** Implemented; deliberate departure from the employer brief.
- **Decision:** No routine per-number verification forms. Inspection is frictionless; users record exceptions and make a final review acknowledgment.
- **Reason:** Repeated review controls created noise and unnecessary work for figures with no identified issue.
- **Tradeoff:** This does not fulfill the original brief's expectation to record verification for every number. Preserve legacy events. Final review remains blocked by unresolved warnings, flags, and proposals, and later review events invalidate it.

### D04 — Keep evidence beside the calculation

- **Recorded:** 2026-10-17. **Status:** Implemented. Resizing reference: `d8c2812`.
- **Decision:** Source documents open in a resizable right panel, with page/field context and exact text highlighting where possible. Mobile uses a bottom panel.
- **Reason:** The screenshots demonstrated the value of inspecting evidence without losing the surrounding schedule. The user requested adjustable panel width.
- **Tradeoff:** Wider evidence reduces calculation space. Resizing is bounded and keyboard accessible. Simulated document text is explicitly labeled; real PDFs are not available.

### D05 — Issue navigation and affected-chain highlighting

- **Recorded:** 2026-10-17. **Status:** Implemented. Current reference: `1e4048a`.
- **Decision:** Issue links reveal the actual calculation path in Summary and visibly scroll to the source. Assignment and resolution appear beside the linked calculation. Highlight affected downstream amounts as well as the source. The original banner placement was superseded by D15.
- **Reason:** Users need both the originating issue and its consequences to be apparent in the overview, without opening more content beneath the banner.
- **Tradeoff:** Multiple totals can be highlighted by the same issue; highlighting signals dependency, not multiple independent errors. Unrelated inputs are not highlighted.
- **Superseded direction:** Source-only highlighting was explicitly requested and implemented in `7c8bb76`. The user subsequently reversed that preference and requested full-chain highlighting. That earlier implementation is not the current design.
- **Limit:** Nonnumeric issues link to their actual records. Never fabricate a numeric relationship to satisfy navigation.

### D06 — Plain-language interface with audit details on demand

- **Recorded:** 2026-10-17. **Status:** Implemented. Reference: `90ce8ee`.
- **Decision:** Remove routine labels such as “F6251.6 · Supplied calculation · Inputs below.” Use calculation names, document names, and human-readable fields. Technical IDs remain available in audit details and the underlying model.
- **Reason:** Implementation terminology does not help the CPA make a decision and makes the interface harder to read.
- **Tradeoff:** Internal IDs are less immediately visible when debugging, but remain available without cluttering routine review.
- **Related preferences:** White background, stronger text/accent contrast, left navigation, and the name Tax workpaper.

### D07 — Integrate other records by subject without inventing arithmetic links

- **Recorded:** 2026-10-17. **Status:** Partially implemented by D10. Same-form links and a complete form index are available; broader subject/entity mapping remains proposed.
- **Problem:** The existing bucket is computed from graph reachability. It groups together records that accountants would associate with different subjects. The 51-of-627 figure describes v3 coverage relative to the current summary roots; it is not a universal tax classification or proof that those records cannot affect current-year work.
- **Proposed decision:** Attach a Related records area to relevant calculation contexts within Summary. Keep calculation inputs and related records visually distinct. Provide a compact subject index in the same workspace so records are accessible even when there is no current-year amount to select.
- **Reason:** Records can belong to the same subject without being operands in the same formula. A future-year balance, filing answer, or supporting explanation should have a meaningful home without being added to a current-year total.
- **Tradeoff:** Subject mappings require careful maintenance and may be many-to-many. The same record may be linked from multiple contexts, but should retain one canonical identity and review history.
- **Alternative rejected:** Insert every record into the arithmetic chain merely to make it reachable. That would imply relationships the packet does not supply.
- **Alternative not preferred:** Retain a miscellaneous catch-all as the primary place to find unrelated-to-total records.

Examples grounded in the supplied packet:

| Supplied record                                 | Proposed context                                                 | Relationship shown to the user                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `F8606.14` — Basis carried to 2026              | Retirement / the Form 8606 calculation behind taxable IRA income | Related retirement record; balance for next year, not an extra current-year income input |
| `F7203.15` — Ending stock basis                 | S corporation / basis calculation                                | Related ownership-basis record; preserve its own calculation and evidence                |
| `SchC.I` and `SchC.J` — Required-1099 questions | The one-person business calculation                              | Filing questions; not arithmetic inputs to business profit                               |

Proposed implementation and acceptance criteria:

1. Keep supplied `inputs` and `sources` as the arithmetic/evidence graph. Do not modify the source packet or overload those edges with subject membership.
2. Add a separate, explicit presentation mapping to topics and display contexts, justified by supplied form, entity, reference, and record metadata. Avoid fuzzy associations based only on similar names or equal amounts. The mapping adds organization, not invented client facts or calculations.
3. Render the selected calculation as a statement, followed by a clearly labeled Related records area. Use useful labels such as Next year or Filing questions only when supported by the record. Keep source inspection in the existing panel.
4. Allow issue links, search, and the subject index to reach a related record directly, reveal its context, and focus it. Records with no numerical counterpart must remain first-class targets.
5. Preserve a visible fallback for unplaced records until mapping coverage is complete. Do not remove the current bucket merely because most records have been assigned.
6. Test every supplied version: every line remains accessible; shared records retain the same review identity; none are silently omitted or included in an invented sum. Expand this inventory to documents and client records as subject mapping is implemented; current 627-line coverage alone is not proof of full-case completeness.

### D08 — Prefer flat calculation statements over deep nesting

- **Recorded:** 2026-10-17. **Status:** Adopted and implemented by D10. This entry preserves the original proposal.
- **Decision under consideration:** Present immediate inputs in an aligned statement with the result underneath. Reveal selected input details in the same workspace while retaining the parent statement and a short location trail. Use transaction tables for large detail, and appropriate presentations for limits, allocations, and carryforwards.
- **Reason:** Deep indentation asks the reviewer to reconstruct arithmetic and remember their position. A flat statement makes the inputs and result easier to compare.
- **Tradeoff:** A focused detail view must retain enough parent context and preserve automatic issue-to-source navigation. One representation will not fit every calculation.
- **Data constraint:** Some packet rules say only “arithmetic combination.” Do not infer operators from coincidental numeric agreement. Show explicit arithmetic only where the supplied rule or other unambiguous packet information establishes it; otherwise retain the supplied explanation and labeled inputs.

### D09 — Cases landing page, consistent language, and local-first delivery

- **Recorded:** 2026-10-17. **Status:** Implemented; ongoing constraints.
- **Decision:** Open on Cases, show the latest-version Issues to resolve count, and use that language consistently. Remove redundant “open items” controls. List only supplied cases. Continue meaningful commits and pushes to the authorized private repository; defer cloud hosting.
- **Reason:** The user wants an understandable entry point, consistent terminology, and a clean employer-reviewable repository while the product is developed locally.
- **Tradeoff:** Reloading returns to Cases rather than restoring a deep location. Browser-local persistence and simulated roles remain prototype limits.

### D10 — Keep return-first; inspect one calculation at a time

- **Recorded:** 2026-10-17. **Status:** Implemented following explicit user approval.
- **Decision:** Keep the federal/California Summary as the central view. Open a single statement beneath the selected summary row. Clicking an input replaces that statement instead of nesting another card. A Review path returns to previous contexts. Source evidence remains in the resizable side panel.
- **Reason:** Deep expansion creates excessive indentation and makes the reviewer reconstruct the calculation while remembering their position. Aligned inputs and a result make immediate relationships easier to scan.
- **Tradeoff accepted:** Reviewers cannot see every calculation depth simultaneously. They gain a bounded layout, but must select inputs to inspect deeper detail. The summary stays in the document above/below the selected row, rather than occupying a fixed panel at every scroll position.
- **Calculation fidelity:** Operations show their supplied explanations and inputs, without invented operators or recomputed totals. R-SUM is described generically as an arithmetic combination, so no addition operator is inferred from that identifier. Long input lists remain searchable and paginated. Specialized allocation/limit visualizations remain future work.
- **Navigation:** Issue links choose the source's actual parent calculation directly, preserve its path, and scroll/focus the referenced record. Affected summary totals, trail entries, inputs, and sources retain issue highlighting. Review path describes navigation history; selecting a related record does not create an arithmetic edge.
- **Related records:** Link records outside summary arithmetic coverage beside calculations sharing their supplied form. Exclude broad summary forms (1040, 540NR, Schedules 1–3), where shared form membership would misleadingly connect unrelated subjects. Describe these explicitly as same-form records, not additional operands. Retain a Related return records form index and search as complete access paths. This conservative mapping avoids invented client facts but is less tailored than future entity-aware topic mappings; records may appear in several contexts with a shared ID and review history.
- **Alternative rejected:** Topic-first as the primary view, and unlimited recursive cards. Neither is required for complete lineage or record access.
- **Validation:** Browser coverage includes forward/back navigation, absence of nested calculations, same-form related records, deep issue jumps, evidence inspection, correction persistence, final sign-off invalidation, roles, mobile layout, and panel resizing. Existing per-version domain coverage protects access to every supplied calculation line.

### D11 — Make document identity and page navigation explicit

- **Recorded:** 2026-10-18. **Status:** Implemented at the user's request.
- **Decision:** Put the supplied document ID (D01, D02, etc.) prominently in the source title. Highlight the selected document in the Documents list using both a colored background and edge marker, with an accessible current-item attribute. Retain that selection when an extracted field is opened.
- **Navigation:** Add Previous page and Next page controls alongside direct page selection. Navigate the sorted supplied pages and disable controls at the ends; do not invent pages from page_count.
- **Field scope:** Replace Other extracted fields on this page with Extracted fields, containing all supplied extracted values for the document across every page, including the selected field. Each row identifies its page. Selecting a field opens that page. Remove the separate Source details disclosure as requested.
- **Tradeoff:** The document-wide field list can be longer, but its name accurately describes its scope and fields remain discoverable when another page is visible. Internal extraction IDs remain in the data rather than requiring a routine UI disclosure.
- **Clarification — search:** Summary search currently performs a case-insensitive substring match against the selected version's calculation key, label, and raw value. It is not full-packet search: document text, extracted fields, notes, and formatted currency are not indexed there. Documents search separately matches document ID, title, and issuer. No search expansion was requested in this change.
- **Clarification — summary layout:** Summary rows are an explicit presentation mapping to supplied federal/California line IDs, not an automatically discovered category hierarchy. The packet also supplies a smaller summary object, but this layout adds specific supplied lines such as withholding and California allocation detail. A new return type requires a new mapping.
- **Clarification — related-record index:** Contextual same-form links are supplementary access paths. The form index retains complete access to lines outside summary arithmetic coverage, including broad-form records deliberately excluded from contextual placement. Removing it now would make some records accessible only through search. Related records keep one canonical identity rather than duplicating financial data.

### D12 — Keep engine references internal; remove Return search

- **Recorded:** 2026-10-18. **Status:** Implemented. Supersedes D06's on-demand visibility of internal calculation IDs and D11's Return-search behavior.
- **Decision:** Remove Find a number or record and its results view. Replace internal calculation references in menus, action dialogs, history targets, and accessibility labels with human labels. Do not render engine_reference rule text. Preserve internal IDs in the graph and review events for stable relationships; this is a UI change, not deletion of provenance.
- **Scope:** Document search and large-list input filtering remain. Input filtering matches labels and values, not graph IDs. Document IDs such as D01 remain visible because the user explicitly requested them.
- **Tradeoff:** Return navigation relies on summary inputs, issue links, and the related-record form index. Removing raw rule text reduces clutter but also removes technical explanations; a future presentation layer should provide professionally worded, verified explanations without exposing engine metadata.
- **Prototype boundary:** The packet is still bundled client-side. Hiding these details from the UI is not a security boundary against inspecting downloaded source data. Preventing delivery to the browser requires a backend and a presentation API.
- **Role findings:** Staff names, roles, and clearance metadata come from firm.staff. The selected identity is in React state; authored review events persist actor/role separately in browser storage. Existing permissions differentiate preparers, reviewers/partners, and read-only roles, but there are no personalized queues, production authentication, clearance enforcement, or timeline-based staff activation checks.
- **Role proposal (not implemented):** Keep the shared case available to authorized staff; provide My work and Awaiting my review based on assignment and workflow state. Role controls actions, assignment controls personal queues, and clearance controls confidential information. Do not simply hide unresolved issues from other authorized collaborators.
- **Summary rationale:** The chosen rows follow income → adjustments → taxable income → tax → payments → settlement. Withholding is a payment component; California allocation needs separate context. The layout is a product choice grounded in Form 1040 and Form 540NR, not a prescribed workpaper format. It is not yet a complete flat tax bridge: credits, adjustments, and other taxes are generally accessed through inputs, and this case's federal amount due / California overpayment cells are case-specific mappings.
- **Related-record storage:** There is no related_records collection. These entries are ordinary return_versions[].lines with form, label, value, rule, inputs, and sources. The app derives the additional set by graph reachability and places links by form membership. Documents alone cannot represent derived balances, calculation chains, or filing answers; documentUsage may link to some of them but is not a completeness guarantee.
- **Accounting references:** [IRS Form 1040 instructions](https://www.irs.gov/instructions/i1040gi) and [California Form 540NR instructions](https://www.ftb.ca.gov/forms/2025/2025-540nr-booklet.html).

### D13 — Document metadata and ownership filters

- **Recorded:** 2026-10-18. **Status:** Implemented at the user's request.
- **Decision:** Remove the Evidence for heading and breadcrumb from the side panel, retaining the close control. The simulated page uses the supplied document title and displays issuer, owner, tax year, received timestamp, and uploader.
- **Data fidelity:** Owner codes resolve to household names using the supplied role or dependent ID; joint remains Joint. Uploaders are Client or Firm because that is all the packet identifies; do not invent individual uploaders. Received timestamps display in UTC to preserve an unambiguous supplied time.
- **Filters:** Documents can be filtered by owner and uploader together with document search. Options come from the packet. Show the matching count, an empty state, and Clear filters. Selected-document highlighting remains independent of the filters; a document stays open if its row is filtered out.
- **Tradeoff:** Removing the contextual breadcrumb gives more room to the document. The underlying calculation remains visible beside the panel, while document identity stays prominent. Metadata is packet context on a simulated page, not a claim that these fields were printed on an original PDF.

### D14 — Clarify snapshot scope and strengthen visual hierarchy

- **Recorded:** 2026-10-18. **Status:** Implemented at the user's request.
- **Snapshot scope:** The selector chooses a complete supplied return snapshot, not a separate document version. The 74-document library is shared, while `documents_used`, `documents_superseded`, linked calculations, issue chains, and displayed totals vary by snapshot. Keep the selector available on Documents because its use and lineage labels depend on the selected snapshot; relabel it Return snapshot and explain that scope in the control.
- **Visual decision:** Preserve the white, restrained workpaper direction while creating distinct levels for case title, page section, subsection, disclosure, and table label. Use a larger Manrope heading scale, uppercase green section kickers, clearer spacing, bordered content surfaces, stronger table headers, and a contained final sign-off panel.
- **Reason:** Similar sizes and weights made headings, subheadings, and controls compete. Reviewers need to scan the case, find issues, interpret totals, and then inspect detail in that order.
- **Tradeoff:** Additional borders and surfaces make sections more explicit but slightly denser. Color remains secondary to size, weight, spacing, and borders so hierarchy survives grayscale and supports accessibility.
- **Boundary:** This is a presentation change. It does not alter packet values, summary mappings, role behavior, document lineage, or review records.

### D15 — Move issues into a dedicated workspace tab

- **Recorded:** 2026-10-18. **Status:** Implemented at the user's request; supersedes the Return-page issue banner placement in D05.
- **Decision:** Add Issues to the left navigation with the live blocking count. Keep the issue list limited to navigation and status. Selecting an item switches to Return, opens the supplied dependency path, scrolls to and focuses the referenced source, and leaves decision/assignment controls beside the affected calculation.
- **Reason:** Issues are a primary review queue and deserve a stable destination. Removing the banner also makes the Return page start directly with the summary while preserving the issue-to-source workflow.
- **Tradeoff:** The unresolved list and affected totals are no longer visible on the same screen. The navigation badge preserves awareness of outstanding work, and a single selection returns the reviewer to the exact calculation context.
- **Table spacing:** Add explicit left padding to the Return item column on desktop and mobile so labels do not touch the table border.

### D16 — Refine the visual system without increasing information density

- **Recorded:** 2026-10-18. **Status:** Implemented at the user's request.
- **Decision:** Preserve the white canvas and existing layout while refining the forest/mint/amber palette, typography, radii, shadows, navigation states, and card surfaces. Add a compact file-check brand mark using the existing icon set. Use one small motion cue on issue-row arrows and respect the existing reduced-motion rule.
- **Reason:** The product should feel deliberate and trustworthy without adding dashboards, illustrations, decorative panels, or more navigation. Visual hierarchy comes from typography, spacing, restrained color, and consistent component treatment.
- **Issue action:** Warning rows say Go to issue and use a right arrow because the action changes context to the Return workspace. Advisory rows say View advisory. Resolved rows retain Resolved. The prior down arrow incorrectly implied movement lower on the same page.
- **Tradeoff:** Subtle shadows and rounded surfaces add polish but can make a dense professional tool feel consumer-oriented if overused. They are limited to primary containers and interactive hover states; calculations and document rows remain visually quiet.
- **Household context label:** Married filing jointly explains the federal filing unit and affects thresholds, deductions, and tax computation. California → Texas explains the part-year California workpaper and allocation columns. These facts are useful orientation, but they are not a full client profile; expanding the line with more household facts would compete with review work.
