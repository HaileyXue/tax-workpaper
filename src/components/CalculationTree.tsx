import { useEffect, useState } from 'react';
import { ChevronRight, FileText, MoreHorizontal } from 'lucide-react';
import { money, sourceAmount, packet, type Graph } from '../domain/packet';
import { calculationPresentation } from '../domain/presentation';
import { amountIssue } from '../domain/schedules';
import type { Finding } from '../domain/findings';
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
  issueFindings?: Finding[];
  revealPath?: string[];
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
      ? `${doc.issuer} · ${doc.document_type} · p. ${value.page} · ${value.label}`
      : doc
        ? doc.title
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
  displayLabel,
  initiallyExpanded = false,
  path = [],
  ...props
}: TreeProps & {
  lineId: string;
  displayLabel?: string;
  initiallyExpanded?: boolean;
  path?: string[];
}) {
  const { graph, events, onAction, writable } = props;
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [mounted, setMounted] = useState(initiallyExpanded);
  const [limit, setLimit] = useState(20);
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!props.revealPath) return;
    const presentation = calculationPresentation(graph, lineId);
    if (!presentation.chain.some((l) => props.revealPath!.includes(l.key)))
      return;
    setExpanded(true);
    setMounted(true);
    setQuery('');
    const detail = presentation.detail;
    const index = Math.max(
      ...[...(detail?.inputs ?? []), ...(detail?.sources ?? [])].map((id, i) =>
        props.revealPath!.includes(id) ? i : -1,
      ),
    );
    setLimit(Math.max(20, index + 1));
  }, [props.revealPath, graph, lineId]);
  const line = graph.lines.get(lineId);
  if (!line)
    return <p className="callout">Missing calculation input: {lineId}</p>;
  if (path.includes(lineId))
    return (
      <p className="callout">
        Circular reference to {lineId}. Check the calculation graph.
      </p>
    );
  const {
    chain,
    detail: sourceLine,
    expandable,
  } = calculationPresentation(graph, lineId);
  const detail = sourceLine!;
  const context = [...path, ...chain.map((item) => item.key)];
  const children = detail.inputs.filter(
    (id) =>
      !query ||
      `${id} ${graph.lines.get(id)?.label} ${graph.lines.get(id)?.value}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const related = events.filter(
    (e) =>
      chain.some((item) => item.key === e.target) &&
      ['flag', 'adjust', 'note'].includes(e.kind),
  );
  const issue = amountIssue(graph, props.issueFindings ?? [], lineId);
  const renderedAmount = (
    <strong
      className={issue ? `amount-issue amount-issue-${issue.kind}` : undefined}
      title={issue?.description}
      aria-description={issue?.description}
    >
      {issue && (
        <span className="issue-symbol" aria-hidden="true">
          !
        </span>
      )}
      {money(line.value)}
    </strong>
  );
  const latestCorrection = related.filter((e) => e.kind === 'adjust').at(-1);
  return (
    <article
      className={`calculation ${expandable ? 'calculation-group' : 'calculation-leaf'}`}
      data-line={lineId}
      data-reference={lineId}
      data-aliases={chain.map((l) => l.key).join(' ')}
      tabIndex={-1}
    >
      <div className="calculation-heading">
        {expandable ? (
          <button
            className="calculation-toggle"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${displayLabel ?? line.label}`}
            onClick={() => {
              setMounted(true);
              setExpanded(!expanded);
            }}
          >
            <ChevronRight size={16} className={expanded ? 'rotated' : ''} />
            <span>{displayLabel ?? line.label}</span>
            {renderedAmount}
          </button>
        ) : (
          <div className="calculation-label">
            <span>{displayLabel ?? line.label}</span>
            {renderedAmount}
          </div>
        )}
        {related.length > 0 && (
          <span className="tag">
            {related.length} {related.length === 1 ? 'note' : 'notes'}
          </span>
        )}
        <details className="action-menu">
          <summary
            aria-label={`Actions for ${line.label}`}
            title="Calculation details and actions"
          >
            <MoreHorizontal size={17} />
          </summary>
          <div>
            {chain.map((item) => (
              <div className="rule-reference" key={item.key}>
                <strong>
                  {item.key} · {item.label}
                </strong>
                <p>{packet.engine_reference.rules[item.rule] ?? item.rule}</p>
                {item.note && <p>{item.note}</p>}
              </div>
            ))}
            {writable && (
              <>
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
              </>
            )}
          </div>
        </details>
      </div>
      {(!expandable || mounted) && (
        <div
          hidden={expandable && !expanded}
          className={expandable ? 'calculation-body' : 'leaf-evidence'}
        >
          {expandable && (
            <div className="calculation-explanation">
              <strong>How this is calculated</strong>
              <p>{packet.engine_reference.rules[detail.rule] ?? detail.rule}</p>
              {detail.note && <p>{detail.note}</p>}
            </div>
          )}
          {latestCorrection && (
            <p className="callout">
              Proposed value: <strong>{money(latestCorrection.amount)}</strong>.
              Current return amount remains {money(line.value)}.{' '}
              {latestCorrection.note}
            </p>
          )}
          {detail.inputs.length > 20 && (
            <label className="detail-search">
              {detail.inputs.length} calculation inputs
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
          {detail.sources.length > 0 && (
            <div className="direct-sources">
              {detail.sources.slice(0, limit).map((id) => {
                const value = graph.values.get(id);
                const sourceIssue = amountIssue(
                  graph,
                  props.issueFindings ?? [],
                  id,
                );
                return (
                  <div
                    className="source-input"
                    key={id}
                    data-reference={id}
                    tabIndex={-1}
                  >
                    <div>
                      {value &&
                        (detail.sources.length > 1 ||
                          sourceIssue ||
                          props.revealPath?.includes(id)) && (
                          <span className="source-value">
                            {graph.documents.get(value.document_id)?.issuer ??
                              value.label}
                            <strong
                              className={
                                sourceIssue
                                  ? 'amount-issue amount-issue-direct'
                                  : undefined
                              }
                              title={sourceIssue?.description}
                            >
                              {sourceIssue && (
                                <span aria-hidden="true">! </span>
                              )}
                              {sourceAmount(value)}
                            </strong>
                          </span>
                        )}
                      <EvidenceLink id={id} path={context} {...props} />
                    </div>
                  </div>
                );
              })}
              {detail.sources.length > limit && (
                <button onClick={() => setLimit(limit + 20)}>
                  Show more source inputs
                </button>
              )}
            </div>
          )}
          {!detail.inputs.length && !detail.sources.length && (
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
