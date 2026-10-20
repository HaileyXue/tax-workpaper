import { useState } from 'react';
import { money, packet, type Graph, type Staff } from '../domain/packet';
import {
  canAssign,
  canWrite,
  estimateImpact,
  proposalDecision,
  type ReviewEvent,
} from '../domain/review';
import type { Finding } from '../domain/findings';
import type { SaveEvent } from './Exceptions';
export default function IssueReview({
  finding: f,
  graph,
  events,
  staff,
  save,
  onPropose,
}: {
  finding: Finding;
  graph: Graph;
  events: ReviewEvent[];
  staff: Staff;
  save: SaveEvent;
  onPropose: (target: string) => void;
}) {
  const [reviewNote, setReviewNote] = useState('');
  const proposal = events
    .filter((event) => event.kind === 'adjust' && event.findingId === f.id)
    .at(-1);
  const decision = proposal && proposalDecision(events, proposal.id);
  const approved = decision?.kind === 'approve';
  const correctionTarget =
    f.correction?.target ??
    f.refs.find(
      (ref) =>
        typeof graph.values.get(ref)?.value === 'number' ||
        typeof graph.lines.get(ref)?.value === 'number',
    ) ??
    f.refs[0] ??
    f.id;
  const reviewer = ['reviewer', 'partner'].includes(staff.role);
  const assignmentAllowed = canAssign(staff);
  const owner =
    events
      .filter((event) => event.target === f.id && event.kind === 'assign')
      .at(-1)?.note ?? 'Unassigned';
  const impact =
    proposal?.category && proposal.taxableDelta !== undefined
      ? estimateImpact(
          packet.return_versions.find(
            (version) => version.version === proposal.version,
          )!,
          proposal.category,
          proposal.taxableDelta,
        )
      : undefined;
  const decide = (kind: 'approve' | 'return' | 'reject') => {
    if (!proposal || !reviewNote.trim()) return;
    if (
      save({
        kind,
        target: proposal.id,
        findingId: f.id,
        note: reviewNote,
      })
    )
      setReviewNote('');
  };
  const assignmentControl = (
    <>
      <label className="owner">
        Assign to
        <select
          aria-label="Assign issue to"
          disabled={!assignmentAllowed}
          value={owner}
          onChange={(event) =>
            save({
              kind: 'assign',
              target: f.id,
              note: event.target.value,
            })
          }
        >
          <option value="Unassigned">Unassigned</option>
          {packet.firm.staff
            .filter((person) =>
              ['preparer', 'reviewer', 'partner'].includes(person.role),
            )
            .map((person) => (
              <option key={person.id} value={person.name}>
                {person.name}
              </option>
            ))}
        </select>
      </label>
      {!assignmentAllowed && (
        <p className="small muted assignment-help">
          Reviewer or partner permission is required to assign work.
        </p>
      )}
    </>
  );
  return (
    <details className="contextual-review">
      <summary>Correction & assignment</summary>{' '}
      {!proposal && (
        <div className="correction-review">
          <strong>Correct this issue</strong>
          {f.correction ? (
            <p>
              The evidence suggests replacing {money(0)} basis with{' '}
              {money(f.correction.proposedValue)}. Review and edit the value
              before submitting it.
            </p>
          ) : (
            <p>
              Propose a corrected value when the issue affects a number, or
              document the action needed to correct a nonnumeric issue.
            </p>
          )}
          <div className="issue-actions">
            <button
              className="primary"
              disabled={!canWrite(staff)}
              onClick={() => onPropose(correctionTarget)}
            >
              Propose correction
            </button>
            {assignmentControl}
          </div>
        </div>
      )}
      {proposal && (
        <div className="proposal-assignment">{assignmentControl}</div>
      )}
      {proposal && (
        <section className="correction-review" aria-label="Correction review">
          <div className="section-top">
            <strong>Correction proposal</strong>
            <span
              className={`proposal-status ${decision?.kind ?? 'submitted'}`}
            >
              {decision?.kind === 'approve'
                ? 'Approved'
                : decision?.kind === 'return'
                  ? 'Returned'
                  : decision?.kind === 'reject'
                    ? 'Rejected'
                    : 'Submitted'}
            </span>
          </div>
          <dl className="proposal-summary">
            {proposal.amount !== undefined && (
              <div>
                <dt>Source value</dt>
                <dd>
                  {money(proposal.original)} → {money(proposal.amount)}
                </dd>
              </div>
            )}
            {proposal.proposedTaxableAmount !== undefined && (
              <div>
                <dt>Proposed sale gain</dt>
                <dd>{money(proposal.proposedTaxableAmount)}</dd>
              </div>
            )}
            {proposal.taxableDelta !== undefined && (
              <div>
                <dt>Taxable change</dt>
                <dd>{money(proposal.taxableDelta)}</dd>
              </div>
            )}
            {impact && (
              <div>
                <dt>Estimated tax change</dt>
                <dd>
                  Federal {money(impact.federal)} · California{' '}
                  {money(impact.california)}
                </dd>
              </div>
            )}
          </dl>
          <p>{proposal.note}</p>
          {decision && (
            <p className="item-note">
              <strong>
                {decision.kind === 'approve'
                  ? 'Approved'
                  : decision.kind === 'return'
                    ? 'Returned'
                    : 'Rejected'}
                :
              </strong>{' '}
              {decision.note}
            </p>
          )}
          {!approved && (
            <div className="proposal-decision">
              <label>
                Reviewer decision
                <textarea
                  aria-label="Reviewer decision"
                  rows={2}
                  required
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  placeholder="Explain the review decision."
                  disabled={!reviewer}
                />
              </label>
              <div>
                <button
                  className="primary"
                  disabled={!reviewer || !reviewNote.trim()}
                  onClick={() => decide('approve')}
                >
                  Approve correction
                </button>
                <button
                  disabled={!reviewer || !reviewNote.trim()}
                  onClick={() => decide('return')}
                >
                  Return for changes
                </button>
                <button
                  disabled={!reviewer || !reviewNote.trim()}
                  onClick={() => decide('reject')}
                >
                  Reject correction
                </button>
              </div>
              {!reviewer && (
                <p className="small muted">
                  Reviewer or partner approval required.
                </p>
              )}
            </div>
          )}
          <p className="small muted">
            Approval documents the review decision. Engine totals remain
            unchanged until a recomputed snapshot is received.
          </p>
        </section>
      )}
      {approved && (
        <p className="approval-complete">
          Approved · this issue is complete for review. The correction remains a
          filing blocker until it is incorporated into a recomputed return.
        </p>
      )}
    </details>
  );
}
