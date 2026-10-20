# End-to-end demo readiness

This document maps the proposed three-to-five-minute product demo to the current application and identifies the remaining implementation work. The demo must use only supplied packet data and must distinguish working behavior, calculated estimates, and replayed scenario events.

## Recommended discrepancy

Use the first Corvane RSU sale as the primary story.

<!-- prettier-ignore -->
| Evidence | Supplied fact |
| --- | --- |
| D28, lot N1 | 400 Corvane RSU shares; proceeds $19,240; basis “not reported” |
| `ev-0498` | The pipeline normalized the blank basis to `$0` with 0.98 confidence |
| D11, lot RSU-2502 | Adjusted cost basis $19,100; matching acquisition date 2025-02-15 |
| Current Form 8949 result | Gain $19,240 because the engine used zero basis |
| Review-supported proposed result | Gain $140 before any other adjustment: $19,240 proceeds less $19,100 basis |

This is a better demonstration than a low-confidence read. It proves that confidence describes the pipeline's certainty, not factual correctness, and that a workpaper must reconcile multiple documents before accepting a value.

The same pattern exists for two additional supplied RSU lots:

- D28 N3 / `ev-0516`: zero basis at 0.98 confidence; D11 supplies $19,100.
- D28 N4 / `ev-0525`: zero basis at 0.98 confidence; D11 supplies $9,420.

## Current demo coverage

<!-- prettier-ignore -->
| Demo step | Current status | What works now | What remains |
| --- | --- | --- | --- |
| 1. Overview | **Partial** | Return summary, case issue count, Issues tab, and final sign-off blockers exist. | Add review progress based on defined required steps and a compact top-three priority list. Do not invent a vague percentage. |
| 2. Open a confident discrepancy | **Working** | A relationship-driven validator finds all three supplied high-confidence zero-basis mistakes and ranks them first. The issue explains the blank-to-zero error and contradictory D11 evidence. | Add a compact top-three overview presentation as part of step 1. |
| 3. Trace to source | **Working** | The issue exposes D28, the corroborating D11 basis/date fields, its Form 8949 path, affected-chain highlights, exact simulated source page/field, and resizable evidence. | A side-by-side two-document comparison could make the match faster, but is not required for the demo. |
| 4. Correct and show impact | **Working** | The typed proposal records original/proposed basis, evidence refs, original/proposed gain, negative taxable delta, affected lines, actor, role, reason, version, and packet-rate estimate without mutating engine totals. | Reconciliation into a newly computed engine snapshot remains unavailable because the packet has only three fixed snapshots. |
| 5. Review control | **Working** | A reviewer/partner can assign work and approve, return, or reject a submitted correction. A preparer can propose but cannot approve. Approval completes issue review; unrelated findings and the unrecomputed proposal continue to block final sign-off. | Production authorization would require a server; current role control is a local prototype simulation. |
| 6. Persistence and audit | **Working** | Assignment, proposal, and approval events persist in `localStorage`, survive refresh, preserve actor/time/version/evidence metadata, appear as one issue-grouped thread in History, support undo, and export to JSON. | Durable multi-user storage remains a production concern. |
| 7. Filing readiness and lifecycle | **Partial** | Blocker count, final sign-off gating, version comparison, and supplied season timeline exist. | Add a filing-readiness checklist and a clearly labeled read-only replay of supplied filing events. Do not present timeline events as actions performed by the prototype. |

## Remaining implementation plan

### 1. Independent confident-error validation

Add a general validator for a numeric zero created from absent source text:

```text
extracted value is numeric zero
+ source text is blank or states not reported
+ confidence is high
+ value feeds a return calculation
= warning: missing source amount was treated as zero
```

For stock compensation, reconcile the missing basis against supplemental evidence using packet-supported identity fields. In this case, the acquisition date uniquely connects each D28 lot to D11. The validator must expose its observed value, contradictory evidence, match key, and affected line; it must not silently rewrite the packet.

Guardrails:

- A printed `0.00` is not missing and must not trigger this rule.
- A blank amount must remain missing unless corroborating evidence supplies a value.
- Confidence must be displayed as extraction metadata, never as verification.
- The rule must work from document/value relationships rather than hard-coded display copy.

### 2. Priority and review progress

Create a deterministic priority score using only review-relevant facts:

- confirmed source contradiction;
- materiality of the direct amount;
- number and importance of downstream lines;
- filing-blocker severity;
- unresolved evidence gap.

The overview should show the three highest-priority unresolved findings and why each ranks highly. Review progress should report concrete counts such as `2 of 12 blocking findings resolved` and required-step completion. It should not claim that an arbitrary percentage means the return is correct.

### 3. Multi-evidence finding view

One issue needs an evidence set, not one source link. The RSU finding should show:

1. D28 N1 basis: not reported;
2. extracted value `ev-0498`: `$0`, 98% confidence;
3. D11 RSU-2502 adjusted basis: `$19,100`;
4. the matching acquisition date;
5. Form 8949 N1 and its downstream consumers.

Selecting either evidence item should open the existing source panel at its page and field without losing the issue context.

### 4. Typed correction proposal

Extend review events so a correction separates the source edit from its tax driver:

```ts
interface CorrectionProposal {
  target: 'ev-0498';
  originalValue: 0;
  proposedValue: 19100;
  reason: string;
  evidenceRefs: ['ev-0498', 'ev-0066', 'ev-0067'];
  affectedLine: 'F8949.B.N1';
  originalTaxableAmount: 19240;
  proposedTaxableAmount: 140;
  taxableDelta: -19100;
  estimateCategory: 'stcg';
}
```

The estimate must use the taxable gain delta of `-$19,100`, not the basis change of `+$19,100`. Engine totals remain immutable. The UI may show a proposal overlay and estimated tax effect, but it must state that a real engine recomputation is still required.

Show affected lines in review order rather than dumping the complete graph:

- directly changed Form 8949 lot;
- Schedule D subtotals;
- federal income and tax lines;
- California allocation/tax lines;
- any limit calculations reached by the graph.

### 5. Correction approval

Add proposal states:

```text
Draft → Submitted → Approved / Returned / Rejected → Reconciled in engine snapshot
```

For this prototype:

- preparer may create, submit, or withdraw their proposal;
- reviewer or partner may approve, return, or reject it;
- read-only roles may inspect but cannot act;
- approval records reviewer, time, evidence, and rationale;
- approval completes the issue's review decision;
- an active or returned proposal blocks final return sign-off;
- proposal approval is not final return sign-off and does not claim engine recomputation.

The demo should show an unauthorized role denied, then an authorized reviewer approving the proposal. Remaining unrelated issues should continue to block the return, and the approved correction remains a filing blocker until a recomputed snapshot incorporates it.

### 6. Issue-centered audit history

Add an audit view grouped by finding or correction, while retaining the append-only event list. It should reconstruct:

- independent check created the finding;
- preparer inspected D28 and D11;
- preparer proposed the basis correction;
- reviewer approved it;
- correction was approved and the issue review completed;
- later changes, if any, reopened the relevant approval.

Refreshing must preserve the same state. The export should include proposal state transitions and evidence references.

### 7. Filing readiness and supplied lifecycle replay

Add a readiness panel with explicit gates:

- blocking findings resolved;
- correction proposals reconciled or withdrawn;
- required completeness steps finished;
- valid reviewer/partner final sign-off;
- client approval/signature status when replaying the supplied scenario.

The later extension, client approval, rejection, acceptance, payment, refund, and notice events already exist in the packet. Present them as `Supplied scenario replay`, with their supplied dates and references. The prototype must not claim it transmitted a return or collected a signature.

## Suggested demo timing

<!-- prettier-ignore -->
| Time | Action |
| --- | --- |
| 0:00–0:30 | Open the case, show summary, concrete review progress, and top three priorities. |
| 0:30–1:15 | Open the RSU basis finding and explain why 98% confidence did not make `$0` correct. |
| 1:15–2:00 | Trace D28, the extracted zero, D11's adjusted basis, Form 8949, and downstream lines. |
| 2:00–2:45 | Propose `$19,100` basis, show `$140` proposed gain and the estimated tax effect from a `-$19,100` taxable delta. |
| 2:45–3:30 | Switch roles, demonstrate denial, and approve as reviewer while the return remains blocked pending recomputation. |
| 3:30–4:15 | Refresh, open the grouped audit history, and reconstruct the actions. |
| 4:15–5:00 | Show remaining filing gates, snapshot comparison, and the supplied lifecycle replay. |

## Definition of done

- The real packet produces the three RSU missing-versus-zero findings without hard-coding their prose into the UI.
- The first finding links D28, D11, the extracted value, Form 8949, and downstream lines.
- The correction estimate uses the gain delta with the correct sign.
- Assignment and proposal approval enforce role rules.
- Final return sign-off remains blocked by unrelated open findings.
- Refresh and export preserve the complete audit trail.
- Filing events are visibly labeled as supplied scenario replay.
- Domain tests cover the validator, false-positive guard, cross-document match, impact direction, permissions, and event state machine.
- A browser test executes the complete demo path from a clean storage state through refresh.
