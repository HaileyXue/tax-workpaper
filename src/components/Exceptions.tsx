import { packet, type Graph, type Staff } from '../domain/packet';
import { canWrite, type ReviewEvent } from '../domain/review';
import type { Finding } from '../domain/findings';
import { EvidenceLink, type TreeProps } from './CalculationTree';
import CalculationTree from './CalculationTree';
export type SaveEvent = (
  event: Omit<ReviewEvent, 'id' | 'at' | 'actor' | 'role' | 'version'>,
) => boolean;
export default function Exceptions({
  findings,
  resolved,
  graph,
  staff,
  save,
  onNavigate,
  ...tree
}: {
  findings: Finding[];
  resolved: (id: string) => boolean;
  graph: Graph;
  staff: Staff;
  save: SaveEvent;
  onNavigate?: (finding: Finding) => void;
} & Omit<TreeProps, 'graph'>) {
  return (
    <div className="findings">
      {findings.map((f) => (
        <details className="finding" key={f.id}>
          <summary
            onClick={(e) => {
              if (!(e.currentTarget.parentElement as HTMLDetailsElement).open)
                onNavigate?.(f);
            }}
            title="Go to the referenced number or evidence"
          >
            <span
              className={`status-dot ${resolved(f.id) ? 'done' : f.severity}`}
            />
            {onNavigate ? (
              <button
                className="issue-jump"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const details = e.currentTarget.closest('details');
                  if (details) details.open = true;
                  onNavigate(f);
                }}
              >
                {f.title}
              </button>
            ) : (
              <span>{f.title}</span>
            )}
            <small>
              {resolved(f.id)
                ? 'Resolved'
                : f.severity === 'warning'
                  ? 'Issue to resolve'
                  : 'Advisory'}
            </small>
          </summary>
          <div className="finding-content">
            <p>{f.detail}</p>
            <p className="muted small">{f.origin}</p>
            {f.refs.map((id) =>
              graph.lines.has(id) ? (
                <CalculationTree key={id} lineId={id} graph={graph} {...tree} />
              ) : (
                <EvidenceLink
                  key={id}
                  id={id}
                  path={[f.title]}
                  graph={graph}
                  onEvidence={tree.onEvidence}
                />
              ),
            )}
            <label className="owner">
              Owner
              <select
                disabled={!canWrite(staff)}
                value={
                  tree.events
                    .filter((e) => e.target === f.id && e.kind === 'assign')
                    .at(-1)?.note ?? ''
                }
                onChange={(e) =>
                  save({ kind: 'assign', target: f.id, note: e.target.value })
                }
              >
                <option value="Unassigned">Unassigned</option>
                {packet.firm.staff
                  .filter((s) =>
                    ['preparer', 'reviewer', 'partner'].includes(s.role),
                  )
                  .map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <form
              className="resolve"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                if (
                  save({
                    kind: resolved(f.id) ? 'reopen' : 'resolve',
                    target: f.id,
                    note: String(new FormData(form).get('reason')),
                  })
                )
                  form.reset();
              }}
            >
              <label>
                Resolution evidence
                <textarea
                  name="reason"
                  required
                  placeholder="Explain the decision and supporting evidence."
                  disabled={!canWrite(staff)}
                />
              </label>
              <button
                disabled={
                  !canWrite(staff) ||
                  (!resolved(f.id) && staff.role === 'preparer')
                }
              >
                {resolved(f.id) ? 'Reopen issue' : 'Resolve issue'}
              </button>
            </form>
            {tree.events
              .filter(
                (e) =>
                  e.target === f.id && ['resolve', 'reopen'].includes(e.kind),
              )
              .slice(-1)
              .map((e) => (
                <p className="item-note" key={e.id}>
                  {e.note}
                </p>
              ))}
          </div>
        </details>
      ))}
    </div>
  );
}
