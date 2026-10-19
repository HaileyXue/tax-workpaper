import { referenceLabel, displayText } from '../domain/presentation';
import { useState } from 'react';
import { money, packet, type Graph, type Staff } from '../domain/packet';
import { activeEvents, canWrite, type ReviewEvent } from '../domain/review';
import type { SaveEvent } from './Exceptions';
import CalculationTree, { type TreeProps } from './CalculationTree';
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
  const [baseId, setBaseId] = useState('v2');
  const base = packet.return_versions.find((v) => v.version === baseId)!;
  const changed = graph.version.lines.filter(
    (l) => base.lines.find((b) => b.key === l.key)?.value !== l.value,
  );
  const removed = base.lines.filter((l) => !graph.lines.has(l.key));
  return (
    <section className="workspace-section history-section">
      <header className="section-heading">
        <div>
          <span className="section-kicker">Audit trail</span>
          <h2>History</h2>
          <p>Compare supplied snapshots and review recorded work.</p>
        </div>
      </header>
      <details className="utility-section">
        <summary>Compare return snapshots</summary>
        <label>
          Compare {graph.version.version} with{' '}
          <select value={baseId} onChange={(e) => setBaseId(e.target.value)}>
            {packet.return_versions.map((v) => (
              <option key={v.version}>{v.version}</option>
            ))}
          </select>
        </label>
        <p className="muted">
          {changed.length} added or changed · {removed.length} removed. Supplied
          snapshots exclude review proposals.
        </p>
        {changed.map((l) => (
          <div key={l.key}>
            <p className="small muted">
              Previously {money(base.lines.find((b) => b.key === l.key)?.value)}
            </p>
            <CalculationTree {...tree} lineId={l.key} />
          </div>
        ))}
        {removed.map((l) => (
          <p key={l.key}>
            {l.label} · {money(l.value)} · Removed
          </p>
        ))}
      </details>
      <details className="utility-section">
        <summary>Precomputed alternatives</summary>
        {packet.what_if.alternatives.map((a) => (
          <div className="history-row" key={a.id}>
            <strong>{a.description}</strong>
            <p>
              Federal tax change {money(a.federal.total_tax_change)} ·
              California {money(a.california.total_tax_change)}
            </p>
            <small>Supplied scenario · base {a.base_version}</small>
          </div>
        ))}
      </details>
      <h3 className="subsection-heading">Review activity</h3>
      {!events.length && (
        <p className="muted">
          No exceptions or sign-offs recorded. Inspecting a number does not
          require a review action.
        </p>
      )}
      {[...events].reverse().map((e) => (
        <div className="history-row" key={e.id}>
          <div>
            <strong>
              {e.kind} ·{' '}
              {referenceLabel(
                graph,
                ['approve', 'return', 'reject'].includes(e.kind)
                  ? (events.find((candidate) => candidate.id === e.target)
                      ?.target ?? e.target)
                  : e.target,
              )}
            </strong>
            <p>{displayText(graph, e.note)}</p>
            {e.kind === 'adjust' && (
              <>
                <p>
                  Source value {money(e.original)} → {money(e.amount)} ·{' '}
                  {e.category}
                </p>
                {e.proposedTaxableAmount !== undefined && (
                  <p>
                    Proposed taxable amount {money(e.proposedTaxableAmount)} ·
                    change {money(e.taxableDelta)}
                  </p>
                )}
              </>
            )}
            <small>
              {packet.firm.staff.find((s) => s.id === e.actor)?.name} ·{' '}
              {e.version} · {new Date(e.at).toLocaleString()}
            </small>
          </div>
          {e.kind !== 'undo' &&
            activeEvents(events).some((a) => a.id === e.id) && (
              <button
                disabled={
                  e.actor !== staff.id ||
                  e.version !== graph.version.version ||
                  !canWrite(staff)
                }
                onClick={() =>
                  save({
                    kind: 'undo',
                    target: e.target,
                    note: `Undo ${e.kind}: ${e.note}`,
                    reverses: e.id,
                  })
                }
              >
                Undo
              </button>
            )}
        </div>
      ))}
      <details className="utility-section">
        <summary>Supplied season timeline</summary>
        <p className="callout">
          Events after June 23, 2026 are scripted scenario data. This workspace
          does not file returns or obtain e-signatures.
        </p>
        {packet.timeline.map((t) => (
          <div className="history-row" key={t.id}>
            <time>{t.at.slice(0, 10)}</time>
            <span>{t.event.replaceAll('_', ' ')}</span>
          </div>
        ))}
      </details>
    </section>
  );
}
