import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  Download,
  Search,
  X,
  FileText,
  History as HistoryIcon,
  LayoutDashboard,
} from 'lucide-react';
import { createGraph, packet, resolveReference } from './domain/packet';
import { findIssues } from './domain/findings';
import {
  activeEvents,
  canWrite,
  loadReviews,
  STORAGE_KEY,
  validateEvent,
  signoffState,
  validateSignoff,
  type ReviewEvent,
} from './domain/review';
import CalculationTree, {
  type EvidenceSelection,
  type ExceptionAction,
  type TreeProps,
} from './components/CalculationTree';
import ReturnSchedules from './components/ReturnSchedules';
import SourceViewer from './components/SourceViewer';
import EvidenceResizeHandle from './components/EvidenceResizeHandle';
import ExceptionForm from './components/ExceptionForm';
import Exceptions from './components/Exceptions';
import History from './components/History';
import ActionDialog from './components/ActionDialog';

const groups = [
  { title: 'Income', keys: ['F1040.9'] },
  {
    title: 'Adjustments & deductions',
    keys: ['F1040.10', 'F1040.11', 'F1040.12', 'F1040.13', 'F1040.15'],
  },
  { title: 'Credits & taxes', keys: ['F1040.19', 'F1040.20', 'F1040.24'] },
  { title: 'Payments & balance', keys: ['F1040.33', 'F1040.37', 'F1040.38'] },
  {
    title: 'California',
    keys: ['F540NR.17', 'F540NR.32', 'F540NR.64', 'F540NR.78', 'F540NR.97'],
  },
];
const initial = loadReviews();
export default function App() {
  const [evidenceWidth, setEvidenceWidth] = useState(440);
  const [tab, setTab] = useState('Return');
  const [version, setVersion] = useState('v3');
  const [staffId, setStaffId] = useState('st-02');
  const [events, setEvents] = useState(initial.events);
  const [error, setError] = useState(initial.error ?? '');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [evidence, setEvidence] = useState<EvidenceSelection | null>(null);
  useEffect(() => {
    if (evidence)
      document
        .querySelector<HTMLButtonElement>('[aria-label="Close evidence"]')
        ?.focus({ preventScroll: true });
  }, [Boolean(evidence)]);
  const [action, setAction] = useState<{
    target: string;
    kind: ExceptionAction;
  } | null>(null);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const [allLines, setAllLines] = useState(30);
  const issueRef = useRef<HTMLDetailsElement>(null);
  const evidenceTrigger = useRef<HTMLElement | null>(null);
  const graph = useMemo(() => createGraph(packet, version), [version]);
  const findings = useMemo(() => findIssues(graph), [graph]);
  const staff = packet.firm.staff.find((s) => s.id === staffId)!;
  const current = activeEvents(events).filter((e) => e.version === version);
  const resolved = (id: string) =>
    current
      .filter((e) => e.target === id && ['resolve', 'reopen'].includes(e.kind))
      .at(-1)?.kind === 'resolve';
  const warnings = findings.filter(
    (f) => f.severity === 'warning' && !resolved(f.id),
  ).length;
  const approval = signoffState(events, version, warnings);
  const save = (
    payload: Omit<ReviewEvent, 'id' | 'at' | 'actor' | 'role' | 'version'>,
  ) => {
    try {
      if (initial.error) throw new Error(initial.error);
      const event: ReviewEvent = {
        ...payload,
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        actor: staff.id,
        role: staff.role,
        version,
      };
      validateEvent(event, staff, events);
      if (event.kind === 'signoff')
        validateSignoff(staff, events, version, warnings);
      const next = [...events, event];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setEvents(next);
      setError('');
      setNotice('Saved to this browser.');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
      return false;
    }
  };
  const openEvidence = (selection: EvidenceSelection) => {
    evidenceTrigger.current = document.activeElement as HTMLElement;
    setEvidence(selection);
  };
  const closeEvidence = () => {
    setEvidence(null);
    evidenceTrigger.current?.focus();
  };
  const tree: TreeProps = {
    graph,
    events: current,
    issueFindings: [
      ...findings.filter((f) => f.severity === 'warning' && !resolved(f.id)),
      ...current
        .filter((e) => e.kind === 'flag' && !resolved(e.id))
        .map((e) => ({
          id: e.id,
          title: e.note,
          detail: e.note,
          refs: [e.target],
          origin: 'Reviewer flag',
          severity: 'warning' as const,
        })),
    ],
    writable: canWrite(staff),
    onEvidence: openEvidence,
    onAction: (target, kind) => setAction({ target, kind }),
  };
  const exportRecords = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              packet: packet.packet,
              exported_at: new Date().toISOString(),
              events,
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tax-workpaper-review-history.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  const value = evidence ? graph.values.get(evidence.ref) : undefined;
  const sourceDoc = evidence
    ? graph.documents.get(value?.document_id ?? evidence.ref)
    : undefined;
  const matchingLines = graph.version.lines.filter((l) =>
    `${l.key} ${l.label} ${l.value}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const activeFlags = current.filter((e) => e.kind === 'flag');
  return (
    <>
      <aside className="app-sidebar" aria-label="Workspace sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab('Return');
          }}
        >
          Tax workpaper
        </a>
        <nav aria-label="Workspace">
          {['Return', 'Documents', 'History'].map((name) => (
            <button
              key={name}
              aria-current={tab === name ? 'page' : undefined}
              onClick={() => {
                setTab(name);
                setSearch('');
              }}
            >
              {name === 'Return' ? (
                <LayoutDashboard size={17} />
              ) : name === 'Documents' ? (
                <FileText size={17} />
              ) : (
                <HistoryIcon size={17} />
              )}
              {name}
            </button>
          ))}
        </nav>
        <label className="staff-selector">
          Viewing as
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            {packet.firm.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.role.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
      </aside>
      <div className={`workspace ${evidence ? 'with-evidence' : ''}`}>
        <main>
          <div className="page-heading">
            <div>
              <span className="eyebrow">2025 TAX RETURN</span>
              <h1>Okafor–Lindqvist</h1>
              <p className="muted">
                Married filing jointly <span>·</span> California → Texas
              </p>
            </div>
            <label>
              Version
              <select
                aria-label="Return version"
                value={version}
                onChange={(e) => {
                  setVersion(e.target.value);
                  setEvidence(null);
                  setSpotlight(null);
                }}
              >
                {packet.return_versions.map((v) => (
                  <option key={v.version}>{v.version}</option>
                ))}
              </select>
            </label>
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice('')}
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div hidden={tab !== 'Return'}>
            <div className="return-intro">
              <p>Open a breakdown or inspect its source.</p>
              <button
                className="issue-count"
                onClick={() => {
                  if (issueRef.current) {
                    issueRef.current.open = true;
                    issueRef.current.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  }
                }}
              >
                {approval.blockers} open{' '}
                {approval.blockers === 1 ? 'item' : 'items'}
              </button>
            </div>
            <details
              ref={issueRef}
              className={`issues-section ${approval.blockers > 0 ? 'has-issues' : ''}`}
            >
              <summary>
                <strong>Issues to resolve</strong>{' '}
                <span>
                  {warnings} warnings · {approval.flags} flags ·{' '}
                  {approval.proposals} proposals
                </span>
              </summary>
              <Exceptions
                {...tree}
                findings={findings}
                resolved={resolved}
                staff={staff}
                save={save}
              />
              {activeFlags.length > 0 && <h3>Raised during review</h3>}
              {activeFlags.map((f) => (
                <details className="finding" key={f.id}>
                  <summary>
                    <span>{f.note}</span>
                    <small>{resolved(f.id) ? 'Resolved' : 'Open'}</small>
                  </summary>
                  <div className="finding-content">
                    {graph.lines.has(f.target) ? (
                      <CalculationTree {...tree} lineId={f.target} />
                    ) : (
                      <button
                        onClick={() =>
                          openEvidence({
                            ref: f.target,
                            path: ['Raised during review'],
                          })
                        }
                      >
                        View evidence
                      </button>
                    )}
                    <form
                      className="resolve"
                      onSubmit={(e) => {
                        e.preventDefault();
                        save({
                          kind: resolved(f.id) ? 'reopen' : 'resolve',
                          target: f.id,
                          note: String(
                            new FormData(e.currentTarget).get('reason'),
                          ),
                        });
                      }}
                    >
                      <label>
                        Resolution evidence
                        <textarea name="reason" required />
                      </label>
                      <button
                        disabled={!canWrite(staff) || staff.role === 'preparer'}
                      >
                        {resolved(f.id) ? 'Reopen issue' : 'Resolve issue'}
                      </button>
                    </form>
                  </div>
                </details>
              ))}
              {approval.proposals > 0 && (
                <p className="callout">
                  Correction proposals remain separate from the engine totals
                  and block final sign-off. Reconcile them with a new engine
                  result or withdraw them in History; this prototype cannot
                  recompute the return.
                </p>
              )}
            </details>
            <ReturnSchedules
              key={version}
              {...tree}
              findings={findings}
              resolved={resolved}
            />
            <details className="utility-section all-calculations">
              <summary>All calculations & schedules</summary>
              <div className="section-heading">
                <h2>Return calculations</h2>
                <label className="search">
                  <Search size={15} />
                  <input
                    aria-label="Search return calculations"
                    placeholder="Find a number or schedule"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setAllLines(30);
                    }}
                  />
                </label>
              </div>
              {spotlight && (
                <section className="spotlight">
                  <div className="section-top">
                    <h3>Linked calculation</h3>
                    <button onClick={() => setSpotlight(null)}>Dismiss</button>
                  </div>
                  <CalculationTree
                    key={`${version}-${spotlight}`}
                    {...tree}
                    lineId={spotlight}
                  />
                </section>
              )}
              <div hidden={Boolean(search)} key={`groups-${version}`}>
                {groups.map((group) => (
                  <section className="return-group" key={group.title}>
                    <h3>{group.title}</h3>
                    {group.keys.map((id) => (
                      <CalculationTree key={id} {...tree} lineId={id} />
                    ))}
                  </section>
                ))}
                <details className="utility-section">
                  <summary>
                    All schedules & additional outputs · {graph.lines.size}{' '}
                    lines
                  </summary>
                  <p className="muted small">
                    Includes informational outputs and detailed schedules. These
                    are not additional amounts to add to the return totals.
                  </p>
                  {graph.version.lines.slice(0, allLines).map((l) => (
                    <CalculationTree key={l.key} {...tree} lineId={l.key} />
                  ))}
                  {allLines < graph.lines.size && (
                    <button onClick={() => setAllLines(allLines + 30)}>
                      Show 30 more lines
                    </button>
                  )}
                </details>
              </div>
              {search && (
                <section aria-label="Search results">
                  <p className="small muted">
                    {matchingLines.length} matching calculations
                  </p>
                  {matchingLines.slice(0, allLines).map((l) => (
                    <CalculationTree
                      key={`${version}-${l.key}`}
                      {...tree}
                      lineId={l.key}
                    />
                  ))}
                  {matchingLines.length > allLines && (
                    <button onClick={() => setAllLines(allLines + 30)}>
                      Show 30 more results
                    </button>
                  )}
                </section>
              )}
            </details>
            <section className="signoff">
              <h2>Final review sign-off</h2>
              <p>
                {approval.valid
                  ? 'Signed off for this review snapshot.'
                  : approval.reopened
                    ? 'Review reopened: records changed after sign-off.'
                    : 'Inspect the return, resolve exceptions, then sign off once.'}
              </p>
              {approval.latest && (
                <p className="small muted">
                  Last sign-off:{' '}
                  {
                    packet.firm.staff.find(
                      (s) => s.id === approval.latest?.actor,
                    )?.name
                  }{' '}
                  · {new Date(approval.latest.at).toLocaleString()}
                </p>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  save({
                    kind: 'signoff',
                    target: 'return',
                    note: String(new FormData(e.currentTarget).get('note')),
                  });
                }}
              >
                <label>
                  <input
                    type="checkbox"
                    required
                    disabled={
                      approval.blockers > 0 ||
                      approval.valid ||
                      !['reviewer', 'partner'].includes(staff.role)
                    }
                  />{' '}
                  I have reviewed this return and its supporting evidence.
                </label>
                <input
                  name="note"
                  type="hidden"
                  value="Reviewed the return and supporting evidence; no open blocking items in this local review snapshot."
                />
                <button
                  className="primary"
                  disabled={
                    approval.blockers > 0 ||
                    approval.valid ||
                    !['reviewer', 'partner'].includes(staff.role)
                  }
                >
                  {approval.valid ? 'Signed off' : 'Sign off return'}
                </button>
              </form>
              <p className="small muted">
                {approval.blockers > 0
                  ? `${approval.blockers} blocking items remain. `
                  : ''}
                Reviewer or partner required. Review sign-off does not file the
                return or certify a recomputed tax result.
              </p>
            </section>
          </div>
          {tab === 'Documents' && (
            <section>
              <div className="section-heading">
                <h2>
                  Documents{' '}
                  <span className="muted">{packet.documents.length}</span>
                </h2>
                <label className="search">
                  <Search size={15} />
                  <input
                    aria-label="Search documents"
                    placeholder="Find a document"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              {packet.documents
                .filter((d) =>
                  `${d.id} ${d.title} ${d.issuer}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((d) => (
                  <button
                    className="document-row"
                    key={d.id}
                    onClick={() =>
                      openEvidence({ ref: d.id, path: ['Documents', d.title] })
                    }
                  >
                    <span className="line-code">{d.id}</span>
                    <span>
                      {d.title}
                      <small>
                        {d.page_count} pages ·{' '}
                        {graph.documentUsage(d.id).length} linked lines
                        {graph.version.documents_superseded.includes(d.id)
                          ? ' · Superseded'
                          : !graph.version.documents_used.includes(d.id)
                            ? ' · Not used in this snapshot'
                            : ''}
                      </small>
                    </span>
                    <span>View source →</span>
                  </button>
                ))}
            </section>
          )}
          {tab === 'History' && (
            <History
              graph={graph}
              events={events}
              staff={staff}
              save={save}
              tree={tree}
            />
          )}
          <footer>
            <span>Fictional data · Browser-local saves · Simulated roles</span>
            <button onClick={exportRecords}>
              <Download size={13} />
              Export history
            </button>
          </footer>
        </main>
        {evidence && (
          <aside
            className="evidence-panel"
            id="source-evidence"
            style={
              { '--evidence-width': `${evidenceWidth}px` } as CSSProperties
            }
            aria-label="Source evidence"
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeEvidence();
            }}
          >
            <EvidenceResizeHandle
              width={evidenceWidth}
              onChange={setEvidenceWidth}
            />
            <div className="evidence-heading">
              <div>
                <span className="eyebrow">EVIDENCE FOR</span>
                <p>
                  {evidence.path
                    .map((id) => graph.lines.get(id)?.label ?? id)
                    .join(' › ')}
                </p>
              </div>
              <button aria-label="Close evidence" onClick={closeEvidence}>
                <X size={18} />
              </button>
            </div>
            <div className="evidence-content">
              {sourceDoc ? (
                <SourceViewer
                  key={`${sourceDoc.id}-${value?.id ?? ''}`}
                  graph={graph}
                  documentId={sourceDoc.id}
                  value={value}
                  onReference={(id) => {
                    if (graph.lines.has(id)) {
                      setSpotlight(id);
                      setTab('Return');
                      setSearch('');
                    } else setEvidence({ ...evidence, ref: id });
                  }}
                />
              ) : (
                <>
                  <h3>{evidence.ref}</h3>
                  {resolveReference(evidence.ref, graph) === undefined ? (
                    <p className="callout">
                      Reference not found in the supplied packet. This remains
                      an evidence gap.
                    </p>
                  ) : (
                    <pre>
                      {JSON.stringify(
                        resolveReference(evidence.ref, graph),
                        null,
                        2,
                      )}
                    </pre>
                  )}
                </>
              )}
              {canWrite(staff) && (
                <div className="evidence-actions">
                  <button
                    onClick={() =>
                      setAction({ target: evidence.ref, kind: 'flag' })
                    }
                  >
                    Flag issue
                  </button>
                  <button
                    onClick={() =>
                      setAction({ target: evidence.ref, kind: 'note' })
                    }
                  >
                    Add note
                  </button>
                  {value && typeof value.value === 'number' && (
                    <button
                      onClick={() =>
                        setAction({ target: evidence.ref, kind: 'adjust' })
                      }
                    >
                      Propose correction
                    </button>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
      {action && (
        <ActionDialog onClose={() => setAction(null)}>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <ExceptionForm
            key={`${action.target}-${action.kind}`}
            target={action.target}
            kind={action.kind}
            graph={graph}
            staff={staff}
            onCancel={() => setAction(null)}
            onSave={(event) => {
              const saved = save(event);
              if (saved) setAction(null);
              return saved;
            }}
          />
        </ActionDialog>
      )}
    </>
  );
}
