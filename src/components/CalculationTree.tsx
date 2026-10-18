import { useEffect, useRef, useState } from 'react';
import { ChevronRight, FileText, MoreHorizontal } from 'lucide-react';
import { money, sourceAmount, packet, type Graph } from '../domain/packet';
import { calculationPresentation } from '../domain/presentation';
import { additionalRecords, amountIssue } from '../domain/schedules';
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
  lineId: rootId,
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
  const heading = useRef<HTMLDivElement>(null);
  const [trail, setTrail] = useState<string[]>([rootId]);
  const lineId = trail.at(-1)!;
  useEffect(() => {
    if (trail.length > 1 && !props.revealPath)
      heading.current?.focus({ preventScroll: true });
  }, [trail, props.revealPath]);
  const navigate = (id: string) => {
    setTrail((current) =>
      current.includes(id)
        ? current.slice(0, current.indexOf(id) + 1)
        : [...current, id],
    );
    setQuery('');
    setLimit(20);
    setExpanded(true);
    setMounted(true);
  };
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [mounted, setMounted] = useState(initiallyExpanded);
  const [limit, setLimit] = useState(20);
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!props.revealPath) return;
    const calculations = props.revealPath.filter((id) => graph.lines.has(id));
    if (!calculations.length) return;
    setTrail(calculations);
    setExpanded(true);
    setMounted(true);
    setQuery('');
    const detail = calculationPresentation(graph, calculations.at(-1)!).detail;
    const index = Math.max(
      -1,
      ...[...(detail?.inputs ?? []), ...(detail?.sources ?? [])].map((id, i) =>
        props.revealPath!.includes(id) ? i : -1,
      ),
    );
    setLimit(Math.max(20, index + 1));
  }, [props.revealPath, graph]);
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
  const context = [...path, ...trail, ...chain.map((item) => item.key)];
  const relatedRecords = additionalRecords(graph).filter(
    (record) =>
      !['F1040', 'F540NR', 'Sch1', 'Sch2', 'Sch3'].includes(record.form) &&
      chain.some((item) => item.form === record.form) &&
      !chain.some((item) => item.key === record.key) &&
      !detail.inputs.includes(record.key),
  );
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
      {trail.length > 1 && (
        <nav className="calculation-trail" aria-label="Review path">
          {trail.map((id, index) => {
            const warning = amountIssue(graph, props.issueFindings ?? [], id);
            return (
              <button
                key={id}
                onClick={() => navigate(id)}
                aria-current={
                  index === trail.length - 1 ? 'location' : undefined
                }
                className={
                  warning
                    ? `amount-issue amount-issue-${warning.kind}`
                    : undefined
                }
              >
                {graph.lines.get(id)?.label ?? id}
                {index < trail.length - 1 && <ChevronRight size={14} />}
              </button>
            );
          })}
        </nav>
      )}
      <div className="calculation-heading" ref={heading} tabIndex={-1}>
        {expandable ? (
          <button
            className="calculation-toggle"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${(lineId === rootId ? displayLabel : undefined) ?? line.label}`}
            onClick={() => {
              setMounted(true);
              setExpanded(!expanded);
            }}
          >
            <ChevronRight size={16} className={expanded ? 'rotated' : ''} />
            <span>
              {(lineId === rootId ? displayLabel : undefined) ?? line.label}
            </span>
            {renderedAmount}
          </button>
        ) : (
          <div className="calculation-label">
            <span>
              {(lineId === rootId ? displayLabel : undefined) ?? line.label}
            </span>
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
            {children.slice(0, limit).map((id) => {
              const input = graph.lines.get(id);
              const warning = amountIssue(graph, props.issueFindings ?? [], id);
              return (
                <button
                  className="calculation-input-row"
                  key={id}
                  onClick={() => navigate(id)}
                  aria-label={`Inspect input ${input?.label ?? id}`}
                >
                  <span>{input?.label ?? 'Missing calculation input'}</span>
                  <strong
                    className={
                      warning
                        ? `amount-issue amount-issue-${warning.kind}`
                        : undefined
                    }
                    title={warning?.description}
                  >
                    {money(input?.value)}
                  </strong>
                  <ChevronRight size={16} />
                </button>
              );
            })}
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
          {(detail.inputs.length > 0 || detail.sources.length > 1) && (
            <div className="calculation-result">
              <span>{line.label}</span>
              {renderedAmount}
            </div>
          )}
          {relatedRecords.length > 0 && (
            <section
              className="related-calculation-records"
              aria-label="Related records"
            >
              <h4>Related records</h4>
              <p className="small muted">
                From the same form; these are not additional inputs to the
                calculation above.
              </p>
              {relatedRecords.map((record) => (
                <button
                  key={record.key}
                  className="calculation-input-row"
                  onClick={() => navigate(record.key)}
                >
                  <span>{record.label}</span>
                  <strong>{money(record.value)}</strong>
                  <ChevronRight size={16} />
                </button>
              ))}
            </section>
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
