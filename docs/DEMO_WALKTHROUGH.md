# Demo walkthrough script

**Target length:** 8:30–9:30

**Primary story:** A high-confidence extraction error is detected, traced across two documents, corrected by a preparer, approved by a reviewer, and preserved as an auditable decision.

## Before recording

1. Start the app with `npm run dev`.
2. Clear prior demo activity in the browser console:

   ```js
   localStorage.removeItem('miraflores.review.v2');
   location.reload();
   ```

3. Use a desktop browser around 1440–1600 pixels wide at 100% zoom.
4. Keep return snapshot `v3` selected.
5. Have these two statements ready to paste:
   - Proposal: `Matched D28 lot N1 to D11 using the supplied acquisition date.`
   - Approval: `Agreed the acquisition date and adjusted basis to D11.`

Do not rush through every field. Pause briefly when the source highlight, correction preview, and review history appear; those are the strongest proof points.

## 0:00–0:40 — Introduce the product

**On screen**

- Begin on **Cases**.
- Point to the issue-count badge on the Okafor–Lindqvist case.
- Click **Open case**.

**Say**

> This is a web-native tax workpaper for a fictional 2025 joint return. The extraction and tax calculations have already happened. The job of this product is to help a CPA understand the result, trace it to evidence, resolve discrepancies, and preserve an auditable review record.
>
> I organized the application around the return because that is the final output the CPA is responsible for. The case currently has 12 issues to resolve, and I am viewing the latest supplied engine snapshot, v3.

## 0:40–1:35 — Trace a normal return number

**On screen**

1. On **Return**, point out the federal and California columns and the role selector.
2. Open federal **Total income**.
3. Select **Total wages**.
4. Open the Corvane W-2 source for the `$104,600` wage amount.
5. Briefly resize the evidence panel, then close it.

**Say**

> The Return page is the central workpaper. Instead of navigating to a separate number explorer, I can open a total, follow its immediate inputs, and retain a visible path back to the return.
>
> This wage amount traces to a specific extracted value and then to the exact field in the simulated source document. The panel stays beside the calculation so I do not lose context. The packet does not include PDFs, so this document is rendered from the supplied page text; the document, page, field, and extracted value are separate records so a real document viewer could replace it later.

## 1:35–2:30 — Open and assign the priority issue

**On screen**

1. Open **Issues**.
2. Select **Lot N1 cost basis was treated as zero**.
3. Point to the calculation path and highlighted affected amounts.
4. Expand **Correction & assignment**.
5. Select **Priya Raman**, then click **Assign**.
6. Switch **Viewing as** to **Priya Raman · preparer**.

**Say**

> The Issues queue prioritizes both supplied engine diagnostics and independent checks performed by this application. It is a work queue, not a second review interface.
>
> Selecting this issue returns me to the exact Form 8949 calculation where it can be understood and acted on. A reviewer who reaches this level manually sees the same issue, evidence, and controls. Higher-level totals are highlighted to show the affected chain without repeating the issue everywhere.
>
> Daniel, the reviewer, assigns the issue to Priya. Selecting a name alone does not change the record; the explicit Assign action creates the audit event.

## 2:30–4:00 — Explain the independent validation and evidence

**On screen**

1. Point to the plain-language issue explanation.
2. Open **D28 · Northlake Securities consolidated Form 1099 — Lot N1 cost basis**.
3. Point out that the basis is not reported, while the extracted value is `$0` at 98% confidence.
4. Open **D11 · Corvane stock plan supplemental tax statement — RSU-2502 adjusted cost basis**.
5. Point out the `$19,100` basis and matching 2025-02-15 acquisition date.
6. Close the evidence panel.

**Say**

> This is the most important engineering example in the prototype. The brokerage left the cost basis blank because it was not reported, but the pipeline normalized the blank to zero with 98% confidence. Confidence tells us that the extraction pipeline is confident in what it produced; it does not prove that the value is economically correct.
>
> The app applies a narrow deterministic check. It looks for a high-confidence numeric zero created from blank source text, confirms that the value feeds a return calculation, and then searches the supplied evidence for a matching lot. D11 contains a $19,100 adjusted basis with the same acquisition date.
>
> The check does not silently change the return. It exposes the observed value, contradictory evidence, match key, affected calculation, and downstream impact so the CPA can make the decision.

## 4:00–5:15 — Propose the correction

**On screen**

1. Expand **Correction & assignment** if needed.
2. Click **Propose correction**.
3. Point to the original basis, proposed basis, proposed gain, taxable change, estimated tax effect, and affected lines.
4. Enter the proposal statement and click **Save proposal**.
5. Show that approval controls are unavailable to Priya.

**Say**

> Priya can propose a correction, but the supplied source and engine snapshots remain immutable. Changing basis from zero to $19,100 changes the proposed lot gain from $19,240 to $140, a negative $19,100 taxable change.
>
> The tax impact is explicitly labeled as an estimate because the application uses the supplied per-dollar rates; it does not claim to rerun the tax engine. The graph also identifies the return lines downstream of this source value.
>
> After Priya saves the proposal, she cannot approve her own work. That separation of duties is enforced in the workflow, although the role switcher itself is only a prototype of server-side authorization.

## 5:15–6:20 — Prove persistence and approve as reviewer

**On screen**

1. Refresh the browser.
2. Reopen the case and return to the same issue.
3. Confirm that the proposal is still present.
4. Use **Daniel Ortiz · reviewer**.
5. Enter the approval statement under **Reviewer decision**.
6. Click **Approve correction**.
7. Point out that the Issues count drops from 12 to 11.

**Say**

> Refreshing proves that the review record persists independently from the supplied JSON. In this prototype it is stored in the browser; a production implementation would use a durable server event store with authenticated users and concurrent-edit controls.
>
> Daniel reviews the same evidence and approves the proposal. Approval is the terminal human decision for this issue, so there is no redundant Resolve action. The open-issue count falls to 11.
>
> Approval still does not rewrite v3. The correction must be incorporated into a future engine snapshot before the return can be filed.

## 6:20–7:20 — Reconstruct the audit trail

**On screen**

1. Open **History**.
2. Stay on the default **Review history** view.
3. Point to the single issue thread containing assignment, proposal, and approval.
4. Point to **Export history**, but do not download unless desired.

**Say**

> History is grouped by issue rather than displaying unrelated log rows. This thread reconstructs the complete decision: Daniel assigned the work, Priya proposed the correction with its original and proposed values, and Daniel approved it with a rationale.
>
> Each event retains its actor, role, timestamp, return version, and evidence context. Events are append-only, and undo is recorded as another event rather than deleting history. The same record can be exported as JSON.

## 7:20–8:10 — Show immutable versions and the current case timeline

**On screen**

1. Select **Return versions**.
2. Point to the `v1`, `v2`, and `v3` cards and the `v3` versus `v2` comparison.
3. Select **Case timeline** and briefly show that it ends at the current `v3` snapshot.

**Say**

> The three engine versions are immutable snapshots. Review proposals are deliberately excluded from snapshot comparisons, which keeps computed results separate from human judgment.
>
> The Case timeline shows only supplied events through the current v3 computation. I left out the packet’s later scripted events because this prototype does not implement signatures, filing, rejections, amendments, or notice management. Showing those events without the underlying lifecycle would overstate what the product can do.

## 8:10–9:05 — Show filing readiness and close

**On screen**

1. Return to **Return**.
2. Scroll to **Final review sign-off**.
3. Point to the blocker message and disabled sign-off controls.
4. End on the Return summary or the approved issue.

**Say**

> Final review sign-off remains blocked. Eleven other issues are still open, and this approved proposal has not been incorporated into a recomputed engine snapshot. That distinction is intentional: approving a review decision is not the same as recalculating or filing a return.
>
> The data model preserves three layers: source evidence, immutable calculated results, and append-only human review records. The lineage graph connects them in both directions, so I can explain where a number came from and what would be affected if its source changes.
>
> I focused the prototype on making this review workflow complete and trustworthy. Production work would move persistence and authorization to a server, add real document storage and access logs, integrate engine recomputation, and then extend into signatures, filing, and post-filing work.

## 9:05–9:25 — Tooling disclosure

**Say**

> I used OpenAI Codex to help inspect the supplied packet, implement and refactor the application, maintain documentation, and run automated tests. I reviewed the product decisions and validation logic. The running application does not call an AI model, and it does not introduce taxpayer facts outside the supplied JSON.

## If time is running long

Cut these moments in order:

1. Do not resize the evidence panel.
2. Skip the Case timeline and mention its scope in the closing sentence.
3. Point to Return versions without scrolling through the changed calculations.
4. Shorten the production roadmap to: “Production would require server-side persistence, authorization, and engine integration.”

Do not cut the cross-document evidence, correction preview, role-controlled approval, refresh, or grouped audit history. Those moments prove the workflow works end to end.
