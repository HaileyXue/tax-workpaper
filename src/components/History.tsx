import { displayText } from '../domain/presentation';
import { useState } from 'react';
import { money, packet, type Graph, type Staff } from '../domain/packet';
import {
  activeEvents,
  canWrite,
  findingIdForEvent,
  findingResolved,
  type ReviewEvent,
} from '../domain/review';
import { findIssues } from '../domain/findings';
import type { SaveEvent } from './Exceptions';
import CalculationTree, { type TreeProps } from './CalculationTree';

type HistoryView = 'review' | 'versions' | 'timeline';

export default function History({
  graph,
  events,
  staff,
  save,
  tree,
}: {
  graph: Graph;
  events: ReviewEvent[];
  staff: Staff;
  save: SaveEvent;
  tree: TreeProps;
}) {
  const [view, setView] = useState<HistoryView>('review');
  const [baseId, setBaseId] = useState('v2');
  const base = packet.return_versions.find(
    (version) => version.version === baseId,
  )!;
  const changed = graph.version.lines.filter(
    (line) =>
      base.lines.find((candidate) => candidate.key === line.key)?.value !==
      line.value,
  );
  const removed = base.lines.filter((line) => !graph.lines.has(line.key));
  const findings = findIssues(graph);
  const currentSnapshotAt = Math.max(
    ...packet.return_versions.map((version) =>
      new Date(version.computed_at).getTime(),
    ),
  );
  const currentTimeline = packet.timeline.filter(
    (event) => new Date(event.at).getTime() <= currentSnapshotAt,
  );
  const actionLabel = (event: ReviewEvent) =>
    ({
      assign: `Assigned to ${event.note}`,
      adjust: 'Proposed correction',
      approve: 'Approved correction',
      return: 'Returned correction',
      reject: 'Rejected correction',
      resolve: 'Completed issue',
      reopen: 'Reopened issue',
      flag: 'Flagged issue',
      note: 'Added note',
      signoff: 'Signed off return',
      undo: 'Undid action',
      verify: 'Verified value',
    })[event.kind] ?? event.kind;
  const eventRow = (event: ReviewEvent) => (
    <div className="review-event" key={event.id}>
      <span className="review-event-dot" aria-hidden="true" />
      <div>
        <strong>{actionLabel(event)}</strong>
        {event.kind !== 'assign' && <p>{displayText(graph, event.note)}</p>}
        {event.kind === 'adjust' && event.amount !== undefined && (
          <p>
            {money(event.original)} → {money(event.amount)}
            {event.proposedTaxableAmount !== undefined &&
              ` · proposed taxable amount ${money(event.proposedTaxableAmount)}`}
          </p>
        )}
        <small>
          {packet.firm.staff.find((person) => person.id === event.actor)
            ?.name ?? 'System'}{' '}
          · {event.version} · {new Date(event.at).toLocaleString()}
        </small>
      </div>
      {event.kind !== 'undo' &&
        activeEvents(events).some((active) => active.id === event.id) && (
          <button
            disabled={
              event.actor !== staff.id ||
              event.version !== graph.version.version ||
              !canWrite(staff)
            }
            onClick={() =>
              save({
                kind: 'undo',
                target: event.target,
                note: `Undo ${event.kind}: ${event.note}`,
                reverses: event.id,
              })
            }
          >
            Undo
          </button>
        )}
    </div>
  );
  const issueThreads = findings
    .map((finding) => ({
      finding,
      activity: events.filter(
        (event) => findingIdForEvent(events, event) === finding.id,
      ),
    }))
    .filter((thread) => thread.activity.length);
  const otherEvents = events.filter(
    (event) => !findingIdForEvent(events, event),
  );
  const timelineRows = (items: typeof packet.timeline) =>
    items.map((event) => (
      <div className="history-row" key={event.id}>
        <time>{event.at.slice(0, 10)}</time>
        <span>{event.event.replaceAll('_', ' ')}</span>
      </div>
    ));

  return (
    <section className="workspace-section history-section">
      <header className="section-heading">
        <div>
          <span className="section-kicker">Audit trail</span>
          <h2>History</h2>
          <p>
            Reconstruct review decisions, return changes, and supplied case
            events.
          </p>
        </div>
      </header>
      <nav className="history-view-switcher" aria-label="History views">
        {[
          ['review', 'Review history'],
          ['versions', 'Return versions'],
          ['timeline', 'Case timeline'],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={view === id}
            onClick={() => setView(id as HistoryView)}
          >
            {label}
          </button>
        ))}
      </nav>

      {view === 'review' && (
        <section aria-label="Review history">
          <div className="history-view-heading">
            <h3>Review history</h3>
            <p>Assignment, correction, and approval are grouped by issue.</p>
          </div>
          {!events.length && (
            <p className="muted">
              No review activity recorded. Inspecting a number does not create
              an action.
            </p>
          )}
          {issueThreads.map(({ finding, activity }) => (
            <article className="issue-history-thread" key={finding.id}>
              <header>
                <div>
                  <span className="section-kicker">Issue</span>
                  <h4>{finding.title}</h4>
                </div>
                <span
                  className={`thread-status ${findingResolved(events, finding.id) ? 'approved' : ''}`}
                >
                  {findingResolved(events, finding.id)
                    ? 'Approved'
                    : 'In progress'}
                </span>
              </header>
              <div className="review-event-list">{activity.map(eventRow)}</div>
            </article>
          ))}
          {otherEvents.length > 0 && (
            <article className="issue-history-thread">
              <header>
                <h4>Other return activity</h4>
              </header>
              <div className="review-event-list">
                {otherEvents.map(eventRow)}
              </div>
            </article>
          )}
        </section>
      )}

      {view === 'versions' && (
        <section aria-label="Return versions">
          <div className="history-view-heading">
            <h3>Return versions</h3>
            <p>
              Supplied engine snapshots and the reason each snapshot was
              created.
            </p>
          </div>
          <div className="version-cards">
            {packet.return_versions.map((version) => (
              <article key={version.version}>
                <strong>{version.version}</strong>
                <span>{version.trigger.replaceAll('_', ' ')}</span>
                <small>
                  {new Date(version.computed_at).toLocaleString()} ·{' '}
                  {version.changes_from_previous.length} recorded changes
                </small>
              </article>
            ))}
          </div>
          <div className="version-compare-control">
            <label>
              Compare {graph.version.version} with{' '}
              <select
                value={baseId}
                onChange={(event) => setBaseId(event.target.value)}
              >
                {packet.return_versions.map((version) => (
                  <option key={version.version}>{version.version}</option>
                ))}
              </select>
            </label>
            <p className="muted">
              {changed.length} added or changed · {removed.length} removed.
              Supplied snapshots exclude review proposals.
            </p>
          </div>
          {changed.map((line) => (
            <div key={line.key}>
              <p className="small muted">
                Previously{' '}
                {money(
                  base.lines.find((candidate) => candidate.key === line.key)
                    ?.value,
                )}
              </p>
              <CalculationTree {...tree} lineId={line.key} />
            </div>
          ))}
          {removed.map((line) => (
            <p key={line.key}>
              {line.label} · {money(line.value)} · Removed
            </p>
          ))}
          <details className="utility-section">
            <summary>Precomputed alternatives</summary>
            {packet.what_if.alternatives.map((alternative) => (
              <div className="history-row" key={alternative.id}>
                <strong>{alternative.description}</strong>
                <p>
                  Federal tax change{' '}
                  {money(alternative.federal.total_tax_change)} · California{' '}
                  {money(alternative.california.total_tax_change)}
                </p>
                <small>
                  Supplied scenario · base {alternative.base_version}
                </small>
              </div>
            ))}
          </details>
        </section>
      )}

      {view === 'timeline' && (
        <section aria-label="Case timeline">
          <div className="history-view-heading">
            <h3>Case timeline</h3>
            <p>
              {currentTimeline.length} events supplied through the current v3
              snapshot. The app does not create or infer these events.
            </p>
          </div>
          {timelineRows(currentTimeline)}
        </section>
      )}
    </section>
  );
}
