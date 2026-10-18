import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { money, sourceAmount } from '../domain/packet';
import {
  additionalRecords,
  amountIssue,
  summaryLocation,
  summaryRows,
} from '../domain/schedules';
import type { Finding } from '../domain/findings';
import CalculationTree, {
  EvidenceLink,
  type TreeProps,
} from './CalculationTree';

export default function ReturnSummary({
  jump,
  issue,
  issuePanel,
  onReference,
  ...tree
}: TreeProps & {
  jump: { ref: string; sequence: number } | null;
  issue: Finding | null;
  issuePanel?: ReactNode;
  onReference: (ref: string) => void;
}) {
  const { graph } = tree;
  const region = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(30);
  const location = useMemo(
    () => (jump ? summaryLocation(graph, jump.ref) : null),
    [graph, jump],
  );
  const records = useMemo(() => additionalRecords(graph), [graph]);
  const forms = [...new Set(records.map((l) => l.form))];
  useEffect(() => {
    if (!location) return;
    setSelected(location.root);
    setQuery('');
  }, [location]);
  useEffect(() => {
    if (!jump || !location) return;
    let frame = 0,
      attempts = 0;
    const scroll = () => {
      const candidates = [
        ...(region.current?.querySelectorAll<HTMLElement>('[data-reference]') ??
          []),
      ];
      const target =
        candidates.find(
          (el) =>
            el.dataset.reference === jump.ref && el.getClientRects().length,
        ) ??
        candidates.find(
          (el) =>
            el.dataset.aliases?.split(' ').includes(jump.ref) &&
            el.getClientRects().length,
        );
      if (target) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({
          block: 'center',
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'instant'
            : 'smooth',
        });
      } else if (++attempts < 120) frame = requestAnimationFrame(scroll);
    };
    frame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(frame);
  }, [jump, location, selected]);
  const context = issue && (
    <div className="issue-context">
      <strong>{issue.title}</strong>
      <p>{issue.detail}</p>
      <div className="issue-references">
        {issue.refs.map((ref) => (
          <button
            key={ref}
            aria-pressed={jump?.ref === ref}
            onClick={() => onReference(ref)}
          >
            {graph.values.get(ref)?.label ?? graph.lines.get(ref)?.label ?? ref}
          </button>
        ))}
      </div>
      {issuePanel}
    </div>
  );
  const calculation = (ref: string) => (
    <CalculationTree
      key={`${graph.version.version}-${ref}`}
      {...tree}
      lineId={ref}
      initiallyExpanded
      revealPath={location?.root === ref ? location.path : undefined}
    />
  );
  const amount = (ref: string | undefined, label: string) => {
    const line = ref && graph.lines.get(ref);
    if (!line || !ref) return <span className="empty-cell">—</span>;
    const warning = amountIssue(graph, tree.issueFindings ?? [], ref);
    return (
      <button
        className={`schedule-amount ${warning ? `amount-issue amount-issue-${warning.kind}` : ''}`}
        aria-label={`Inspect ${label} ${line.label}`}
        aria-description={warning?.description}
        title={warning?.description}
        aria-expanded={selected === ref}
        onClick={() => setSelected(selected === ref ? null : ref)}
      >
        {warning && <span aria-hidden="true">! </span>}
        {money(line.value)}
      </button>
    );
  };
  const matches = [...graph.lines.values()].filter((l) =>
    `${l.key} ${l.label} ${l.value}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section
      className="return-schedules"
      aria-label="Return summary"
      ref={region}
    >
      <div className="section-heading">
        <div>
          <h2>Return summary</h2>
          <p className="small muted">
            Open a total to follow its calculations to the source. Highlighted
            amounts share an issue along that calculation chain.
          </p>
        </div>
        <label className="search">
          <input
            aria-label="Search return calculations"
            placeholder="Find a number or record"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(30);
            }}
          />
        </label>
      </div>
      {!query ? (
        <>
          <div className="schedule-scroll">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th scope="col">Return item</th>
                  <th scope="col">Federal</th>
                  <th scope="col">California</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row) => {
                  const federal = 'federal' in row ? row.federal : undefined;
                  const california =
                    'california' in row ? row.california : undefined;
                  const expanded =
                    selected && [federal, california].includes(selected);
                  return (
                    <Fragment key={row.label}>
                      <tr>
                        <th scope="row">
                          {row.label}
                          {'note' in row && (
                            <small className="row-context">{row.note}</small>
                          )}
                        </th>
                        <td>{amount(federal, 'Federal')}</td>
                        <td>{amount(california, 'California')}</td>
                      </tr>
                      {expanded && (
                        <tr className="schedule-breakdown">
                          <td colSpan={3}>
                            <div className="section-top">
                              <span>Supporting calculation</span>
                              <button onClick={() => setSelected(null)}>
                                Close calculation
                              </button>
                            </div>
                            {location?.root === selected && context}
                            {calculation(selected)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="schedule-footnote">
            — means no figure is mapped for this cell, not zero. Amounts come
            from the selected return version.
          </p>
          <section
            className="additional-records"
            aria-label="Related return records"
          >
            <h3>Related return records</h3>
            <p className="small muted">
              Find supporting records by form, including carryforwards and
              filing questions. They are also linked beside calculations from
              the same form.
            </p>
            {location?.additional && !graph.lines.has(location.root) && (
              <div
                className="standalone-record"
                data-reference={location.root}
                tabIndex={-1}
              >
                {context}
                {graph.values.has(location.root) ? (
                  <p className="amount-issue amount-issue-direct">
                    {sourceAmount(graph.values.get(location.root)!)}
                  </p>
                ) : (
                  <p>
                    This issue concerns a record rather than a calculated
                    number.
                  </p>
                )}
                <EvidenceLink
                  {...tree}
                  id={location.root}
                  path={['Return summary', 'Related return records']}
                />
              </div>
            )}
            {forms.map((form) => (
              <details
                className="record-group"
                key={`${form}-${jump?.sequence ?? ''}`}
                open={
                  location?.additional &&
                  records.some(
                    (l) => l.form === form && l.key === location.root,
                  )
                    ? true
                    : undefined
                }
              >
                <summary>
                  {form} · {records.filter((l) => l.form === form).length}{' '}
                  records
                </summary>
                {records
                  .filter((l) => l.form === form)
                  .map((line) => (
                    <div key={line.key}>
                      {location?.root === line.key && context}
                      <CalculationTree
                        {...tree}
                        lineId={line.key}
                        revealPath={
                          location?.root === line.key
                            ? location.path
                            : undefined
                        }
                      />
                    </div>
                  ))}
              </details>
            ))}
          </section>
        </>
      ) : (
        <section aria-label="Search results">
          <p>{matches.length} matching calculations</p>
          {matches.slice(0, limit).map((line) => (
            <CalculationTree {...tree} key={line.key} lineId={line.key} />
          ))}
          {matches.length > limit && (
            <button onClick={() => setLimit(limit + 30)}>
              Show 30 more results
            </button>
          )}
        </section>
      )}
    </section>
  );
}
