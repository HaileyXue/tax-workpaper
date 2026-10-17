import { Fragment, useState } from 'react';
import { money } from '../domain/packet';
import {
  dividends,
  relevantFindings,
  summaryRows,
  wagesAndInterest,
  type ScheduleRow,
} from '../domain/schedules';
import type { Finding } from '../domain/findings';
import CalculationTree, { type TreeProps } from './CalculationTree';

export default function ReturnSchedules({
  findings,
  resolved,
  ...tree
}: TreeProps & { findings: Finding[]; resolved: (id: string) => boolean }) {
  const { graph, onEvidence } = tree;
  const [view, setView] = useState('Summary');
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const open = findings.filter(
    (f) => f.severity === 'warning' && !resolved(f.id),
  );
  const rows =
    view === 'Wages & interest' ? wagesAndInterest(graph) : dividends(graph);
  const columns =
    view === 'Wages & interest'
      ? [
          ['wages', 'Wages'],
          ['withholding', 'Federal withholding'],
          ['stateWithholding', 'CA withholding'],
          ['interest', 'Interest'],
        ]
      : [
          ['ordinary', 'Ordinary dividends'],
          ['qualified', 'Qualified dividends'],
        ];
  const inspect = (ref: string, path: string[]) => {
    setActiveCell(ref);
    if (graph.values.has(ref)) {
      setSelected(null);
      onEvidence({ ref, path });
    } else setSelected(selected === ref ? null : ref);
  };
  const amount = (ref: string | undefined, path: string[]) => {
    if (!ref) return <span className="empty-cell">—</span>;
    const item = graph.values.get(ref) ?? graph.lines.get(ref);
    if (!item) return <span className="empty-cell">—</span>;
    return (
      <button
        className={`schedule-amount ${activeCell === ref ? 'is-selected' : ''}`}
        aria-label={`Inspect ${path.at(-1)} ${ref}`}
        aria-expanded={graph.lines.has(ref) ? selected === ref : undefined}
        onClick={() => inspect(ref, path)}
      >
        {money(item.value)}
      </button>
    );
  };
  const breakdown = (refs: (string | undefined)[], colSpan: number) =>
    selected && refs.includes(selected) ? (
      <tr className="schedule-breakdown">
        <td colSpan={colSpan}>
          <div className="section-top">
            <span className="small muted">
              Calculation from the selected engine snapshot
            </span>
            <button onClick={() => setSelected(null)}>Close calculation</button>
          </div>
          <CalculationTree
            key={`${graph.version.version}-${selected}`}
            {...tree}
            lineId={selected}
            initiallyExpanded
          />
        </td>
      </tr>
    ) : null;
  const warnings = (refs: string[]) => relevantFindings(graph, open, refs);
  const renderWarning = (items: Finding[]) =>
    items.length > 0 && (
      <details className="inline-findings">
        <summary>
          {items.length} {items.length === 1 ? 'item' : 'items'} to review
        </summary>
        {items.map((f) => (
          <div key={f.id}>
            <strong>{f.title}</strong>
            <p>{f.detail}</p>
            <small>{f.origin}</small>
          </div>
        ))}
      </details>
    );
  const totalRefs =
    view === 'Wages & interest'
      ? {
          wages: 'F1040.1a',
          withholding: 'F1040.25a',
          stateWithholding: 'F540NR.71',
          interest: 'F1040.2b',
        }
      : { ordinary: 'F1040.3b', qualified: 'F1040.3a' };
  const renderRow = (row: ScheduleRow) => (
    <Fragment key={row.id}>
      <tr>
        <th scope="row">
          <span>{row.label}</span>
          {row.documentId && (
            <button
              className="schedule-document"
              onClick={() =>
                onEvidence({ ref: row.documentId!, path: [view, row.label] })
              }
            >
              {row.documentId} ·{' '}
              {graph.documents.get(row.documentId)?.document_type}
            </button>
          )}
          {renderWarning(
            warnings(
              Object.values(row.cells).filter((v): v is string => Boolean(v)),
            ),
          )}
        </th>
        {columns.map(([key, label]) => (
          <td key={key}>{amount(row.cells[key], [view, row.label, label])}</td>
        ))}
      </tr>
      {breakdown(Object.values(row.cells), columns.length + 1)}
    </Fragment>
  );
  return (
    <section className="return-schedules" aria-label="Return schedules">
      <div
        className="schedule-tabs"
        role="tablist"
        aria-label="Return schedules"
      >
        {['Summary', 'Wages & interest', 'Dividends'].map((name) => (
          <button
            key={name}
            role="tab"
            id={`tab-${name.replaceAll(' ', '-')}`}
            aria-controls="schedule-panel"
            aria-selected={view === name}
            tabIndex={view === name ? 0 : -1}
            onKeyDown={(e) => {
              const names = ['Summary', 'Wages & interest', 'Dividends'];
              const index = names.indexOf(name);
              const next =
                e.key === 'ArrowRight'
                  ? (index + 1) % 3
                  : e.key === 'ArrowLeft'
                    ? (index + 2) % 3
                    : e.key === 'Home'
                      ? 0
                      : e.key === 'End'
                        ? 2
                        : -1;
              if (next < 0) return;
              e.preventDefault();
              setView(names[next]);
              setSelected(null);
              setActiveCell(null);
              e.currentTarget.parentElement
                ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                [next]?.focus();
            }}
            onClick={() => {
              setView(name);
              setSelected(null);
              setActiveCell(null);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="schedule-panel"
        aria-labelledby={`tab-${view.replaceAll(' ', '-')}`}
      >
        <div className="schedule-intro">
          <h2>{view === 'Summary' ? 'Return summary' : view}</h2>
          <p>
            {view === 'Summary'
              ? 'Federal and California figures from the selected engine snapshot.'
              : 'Related figures together. Select an amount to inspect its evidence or calculation.'}
          </p>
        </div>
        <div className="schedule-scroll">
          <table className="schedule-table">
            <thead>
              <tr>
                <th scope="col">
                  {view === 'Summary' ? 'Return item' : 'Source'}
                </th>
                {(view === 'Summary'
                  ? ['Federal', 'California']
                  : columns.map((c) => c[1])
                ).map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view === 'Summary'
                ? summaryRows.map((row) => {
                    const federal = 'federal' in row ? row.federal : undefined;
                    const california =
                      'california' in row ? row.california : undefined;
                    const refs = [federal, california];
                    return (
                      <Fragment key={row.label}>
                        <tr>
                          <th scope="row">
                            {row.label}
                            {'note' in row && (
                              <small className="row-context">{row.note}</small>
                            )}
                            {renderWarning(
                              warnings(
                                refs.filter((v): v is string => Boolean(v)),
                              ),
                            )}
                          </th>
                          <td>
                            {amount(federal, ['Summary', row.label, 'Federal'])}
                          </td>
                          <td>
                            {amount(california, [
                              'Summary',
                              row.label,
                              'California',
                            ])}
                          </td>
                        </tr>
                        {breakdown(refs, 3)}
                      </Fragment>
                    );
                  })
                : rows.map(renderRow)}
            </tbody>
            {view !== 'Summary' && (
              <tfoot>
                <tr>
                  <th scope="row">Engine totals</th>
                  {columns.map(([key, label]) => (
                    <td key={key}>
                      {amount(totalRefs[key as keyof typeof totalRefs], [
                        view,
                        'Engine totals',
                        label,
                      ])}
                    </td>
                  ))}
                </tr>
                {breakdown(Object.values(totalRefs), columns.length + 1)}
              </tfoot>
            )}
          </table>
        </div>
        <p className="schedule-footnote">
          — means no figure is mapped from the packet for this cell; it does not
          mean zero.{' '}
          {view !== 'Summary' &&
            'Totals are supplied engine values, not a new tax calculation or verification.'}
        </p>
        {view === 'Wages & interest' && graph.lines.get('F1040.1a')?.note && (
          <p className="schedule-footnote">
            {graph.lines.get('F1040.1a')?.note}
          </p>
        )}
      </div>
    </section>
  );
}
