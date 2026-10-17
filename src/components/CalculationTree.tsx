import { useState } from 'react';
import { ChevronRight, FileText, MoreHorizontal } from 'lucide-react';
import { money, packet, type Graph } from '../domain/packet';
import type { ReviewEvent } from '../domain/review';

export interface EvidenceSelection {
  ref: string;
  path: string[];
}
export type ExceptionAction = 'flag' | 'adjust' | 'note';
export interface TreeProps {
  graph: Graph;
  onEvidence: (selection: EvidenceSelection) => void;
  onAction: (target: string, kind: ExceptionAction) => void;
  events: ReviewEvent[];
  writable: boolean;
}
export function EvidenceLink({
  id,
  path,
  graph,
  onEvidence,
}: Pick<TreeProps, 'graph' | 'onEvidence'> & { id: string; path: string[] }) {
  const value = graph.values.get(id);
  const doc = value
    ? graph.documents.get(value.document_id)
    : graph.documents.get(id);
  const label =
    value && doc
      ? `${doc.id} · ${doc.document_type} · p. ${value.page} · ${value.label}`
      : doc
        ? `${doc.id} · ${doc.title}`
        : id.startsWith('py:')
          ? `Prior year · ${id.slice(3)}`
          : id.startsWith('ref:')
            ? `Reference · ${id.slice(4)}`
            : id;
  return (
    <button
      className="evidence-link"
      onClick={() => onEvidence({ ref: id, path })}
    >
      <FileText size={13} />
      {label}
    </button>
  );
}
export default function CalculationTree({
  lineId,
  path = [],
  ...props
}: TreeProps & { lineId: string; path?: string[] }) {
  const { graph, events, onAction, writable } = props;
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [limit, setLimit] = useState(20);
  const [query, setQuery] = useState('');
  const line = graph.lines.get(lineId);
  if (!line)
    return <p className="callout">Missing calculation input: {lineId}</p>;
  if (path.includes(lineId))
    return (
      <p className="callout">
        Circular reference to {lineId}. Check the calculation graph.
      </p>
    );
  const context = [...path, lineId];
  const children = line.inputs.filter(
    (id) =>
      !query ||
      `${id} ${graph.lines.get(id)?.label} ${graph.lines.get(id)?.value}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const related = events.filter(
    (e) => e.target === lineId && ['flag', 'adjust', 'note'].includes(e.kind),
  );
  const latestCorrection = related.filter((e) => e.kind === 'adjust').at(-1);
  return (
    <article className="calculation" data-line={lineId}>
      <div className="calculation-heading">
        <button
          className="calculation-toggle"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${line.label} (${lineId})`}
          onClick={() => {
            setMounted(true);
            setExpanded(!expanded);
          }}
        >
          <ChevronRight size={16} className={expanded ? 'rotated' : ''} />
          <span>
            {line.label}
            <small>{line.key}</small>
          </span>
          <strong>{money(line.value)}</strong>
        </button>
        {related.length > 0 && (
          <span className="tag">
            {related.length} {related.length === 1 ? 'note' : 'notes'}
          </span>
        )}
      </div>
      {mounted && (
        <div hidden={!expanded} className="calculation-body">
          <div className="calculation-context">
            <span>{context.join(' › ')}</span>
            {writable && (
              <details className="action-menu">
                <summary aria-label={`Actions for ${lineId}`}>
                  <MoreHorizontal size={17} /> Actions
                </summary>
                <div>
                  <button onClick={() => onAction(lineId, 'flag')}>
                    Flag issue
                  </button>
                  {typeof line.value === 'number' && (
                    <button onClick={() => onAction(lineId, 'adjust')}>
                      Propose correction
                    </button>
                  )}
                  <button onClick={() => onAction(lineId, 'note')}>
                    Add note
                  </button>
                </div>
              </details>
            )}
          </div>
          {latestCorrection && (
            <p className="callout">
              Proposed value: <strong>{money(latestCorrection.amount)}</strong>.
              Engine amount remains {money(line.value)}. {latestCorrection.note}
            </p>
          )}
          <p className="calculation-rule">
            {packet.engine_reference.rules[line.rule] ?? line.rule}
          </p>
          {line.note && <p className="muted small">{line.note}</p>}
          {line.inputs.length > 20 && (
            <label className="detail-search">
              {line.inputs.length} calculation inputs
              <input
                aria-label={`Search inputs for ${lineId}`}
                placeholder="Find a transaction or input…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(20);
                }}
              />
            </label>
          )}
          <div className="calculation-children">
            {children.slice(0, limit).map((id) => (
              <CalculationTree key={id} {...props} lineId={id} path={context} />
            ))}
          </div>
          {children.length > limit && (
            <button
              className="text-button"
              onClick={() => setLimit(limit + 20)}
            >
              Show 20 more inputs ({children.length - limit} remaining)
            </button>
          )}
          {line.sources.length > 0 && (
            <div className="direct-sources">
              <span className="eyebrow">
                {line.inputs.length
                  ? 'Additional evidence for this calculation'
                  : 'Source inputs'}
              </span>
              {line.sources.slice(0, limit).map((id) => {
                const value = graph.values.get(id);
                return (
                  <div className="source-input" key={id}>
                    <div>
                      {value && (
                        <span className="source-value">
                          {value.label}
                          <strong>
                            {value.value_type === 'money'
                              ? money(value.value)
                              : String(value.value ?? '—')}
                          </strong>
                        </span>
                      )}
                      <EvidenceLink id={id} path={context} {...props} />
                    </div>
                  </div>
                );
              })}
              {line.sources.length > limit && (
                <button onClick={() => setLimit(limit + 20)}>
                  Show more source inputs
                </button>
              )}
            </div>
          )}
          {!line.inputs.length && !line.sources.length && (
            <p className="muted small">
              No source reference supplied. Inspect the rule or flag an evidence
              gap.
            </p>
          )}
          {related
            .filter((e) => e.kind !== 'adjust')
            .map((e) => (
              <p className="item-note" key={e.id}>
                <strong>{e.kind === 'flag' ? 'Issue' : 'Note'}:</strong>{' '}
                {e.note}
              </p>
            ))}
        </div>
      )}
    </article>
  );
}
