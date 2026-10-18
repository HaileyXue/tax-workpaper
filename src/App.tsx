import { documentOwnerLabel, documentUploaderLabel } from './domain/packet';
import { referenceLabel, displayText } from './domain/presentation';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  Download,
  ArrowLeft,
  Search,
  X,
  FileText,
  History as HistoryIcon,
  LayoutDashboard,
  CircleAlert,
  FileCheck2,
} from 'lucide-react';
import { createGraph, packet, resolveReference } from './domain/packet';
import { findIssues, type Finding } from './domain/findings';
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
import {
  type EvidenceSelection,
  type ExceptionAction,
  type TreeProps,
} from './components/CalculationTree';
import ReturnSummary from './components/ReturnSummary';
import Cases from './components/Cases';
import SourceViewer from './components/SourceViewer';
import EvidenceResizeHandle from './components/EvidenceResizeHandle';
import ExceptionForm from './components/ExceptionForm';
import Exceptions from './components/Exceptions';
import IssueReview from './components/IssueReview';
import History from './components/History';
import ActionDialog from './components/ActionDialog';

const initial = loadReviews();
export default function App() {
  const [caseOpen, setCaseOpen] = useState(false);
  const [evidenceWidth, setEvidenceWidth] = useState(440);
  const [tab, setTab] = useState('Return');
  const [version, setVersion] = useState('v3');
  const [staffId, setStaffId] = useState('st-02');
  const [events, setEvents] = useState(initial.events);
  const [error, setError] = useState(initial.error ?? '');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [documentOwner, setDocumentOwner] = useState('');
  const [documentUploader, setDocumentUploader] = useState('');
  const filteredDocuments = packet.documents.filter(
    (d) =>
      (!documentOwner || d.belongs_to === documentOwner) &&
      (!documentUploader || d.uploaded_by === documentUploader) &&
      `${d.id} ${d.title} ${d.issuer}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
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
  const [focusedIssue, setFocusedIssue] = useState<Finding | null>(null);
  const [summaryJump, setSummaryJump] = useState<{
    ref: string;
    sequence: number;
  } | null>(null);
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
  const navigateIssue = (finding: Finding) => {
    setTab('Return');
    setEvidence(null);
    setFocusedIssue({ ...finding });
    setSearch('');
    setSummaryJump({ ref: finding.refs[0], sequence: performance.now() });
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
  const activeFlags = current.filter((e) => e.kind === 'flag');
  const issueItems: Finding[] = [
    ...findings,
    ...current
      .filter((e) => e.kind === 'adjust')
      .map((f) => ({
        id: f.id,
        title: `Correction proposal: ${referenceLabel(graph, f.target)}`,
        detail: f.note,
        refs: [f.target],
        origin: 'Correction proposal',
        severity: 'warning' as const,
      })),
    ...activeFlags.map((f) => ({
      id: f.id,
      title: f.note,
      detail: f.note,
      refs: [f.target],
      origin: 'Reviewer flag',
      severity: 'warning' as const,
    })),
  ];
  const showCases = () => {
    setEvidence(null);
    setAction(null);
    setCaseOpen(false);
    setSummaryJump(null);
    setFocusedIssue(null);
    setNotice('');
  };
  if (!caseOpen)
    return (
      <Cases
        events={events}
        error={error}
        onOpen={(latestVersion) => {
          setVersion(latestVersion);
          setTab('Return');
          setSearch('');
          setSummaryJump(null);
          setCaseOpen(true);
        }}
      />
    );
  return (
    <>
      <aside className="app-sidebar" aria-label="Workspace sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            showCases();
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            <FileCheck2 size={17} />
          </span>
          <span>Tax workpaper</span>
        </a>
        <button className="back-to-cases" onClick={showCases}>
          <ArrowLeft size={16} />
          All cases
        </button>
        <nav aria-label="Workspace">
          {['Return', 'Issues', 'Documents', 'History'].map((name) => (
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
              ) : name === 'Issues' ? (
                <CircleAlert size={17} />
              ) : name === 'Documents' ? (
                <FileText size={17} />
              ) : (
                <HistoryIcon size={17} />
              )}
              <span>{name}</span>
              {name === 'Issues' && approval.blockers > 0 && (
                <span
                  className="nav-count"
                  aria-label={`${approval.blockers} issues to resolve`}
                >
                  {approval.blockers}
                </span>
              )}
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
            <label className="snapshot-selector">
              <span>Return snapshot</span>
              <select
                aria-label="Return version"
                value={version}
                onChange={(e) => {
                  setVersion(e.target.value);
                  setSummaryJump(null);
                  setFocusedIssue(null);
                  setEvidence(null);
                }}
              >
                {packet.return_versions.map((v) => (
                  <option key={v.version}>{v.version}</option>
                ))}
              </select>
              <small>Controls calculations, document use, and lineage.</small>
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
            </div>
            <ReturnSummary
              key={version}
              {...tree}
              jump={summaryJump}
              issue={focusedIssue}
              onReference={(ref) =>
                setSummaryJump({ ref, sequence: performance.now() })
              }
              issuePanel={
                focusedIssue &&
                (focusedIssue.origin === 'Correction proposal' ? (
                  <p>
                    This proposal does not change engine totals.{' '}
                    <button onClick={() => setTab('History')}>
                      Review proposal in History
                    </button>
                  </p>
                ) : (
                  <IssueReview
                    key={focusedIssue.id}
                    finding={focusedIssue}
                    events={current}
                    staff={staff}
                    save={save}
                    resolved={resolved}
                  />
                ))
              }
            />
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
                  value="Reviewed the return and supporting evidence; no issues to resolve in this local review snapshot."
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
                  ? `${approval.blockers} ${approval.blockers === 1 ? 'issue' : 'issues'} to resolve. `
                  : ''}
                Reviewer or partner required. Review sign-off does not file the
                return or certify a recomputed tax result.
              </p>
            </section>
          </div>
          {tab === 'Issues' && (
            <section className="workspace-section issues-workspace">
              <header className="section-heading">
                <div>
                  <span className="section-kicker">Review queue</span>
                  <h2>Issues to resolve</h2>
                  <p>
                    Select an issue to open its affected calculation and source
                    in the Return tab.
                  </p>
                </div>
                <span
                  className={`issue-total ${approval.blockers > 0 ? 'has-issues' : ''}`}
                  role="status"
                >
                  {approval.blockers}{' '}
                  {approval.blockers === 1 ? 'issue' : 'issues'} to resolve
                </span>
              </header>
              <div className="issues-list-panel">
                <Exceptions
                  findings={issueItems}
                  resolved={resolved}
                  onNavigate={navigateIssue}
                />
              </div>
            </section>
          )}
          {tab === 'Documents' && (
            <section className="workspace-section documents-section">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Source library</span>
                  <h2>
                    Documents{' '}
                    <span className="heading-count">
                      {packet.documents.length}
                    </span>
                  </h2>
                  <p>
                    Inspect supplied source files and their use in the selected
                    return snapshot.
                  </p>
                </div>
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
              <div className="document-filters">
                <label>
                  Belongs to
                  <select
                    value={documentOwner}
                    onChange={(e) => setDocumentOwner(e.target.value)}
                  >
                    <option value="">All owners</option>
                    {[
                      ...new Set(packet.documents.map((d) => d.belongs_to)),
                    ].map((owner) => (
                      <option key={owner} value={owner}>
                        {documentOwnerLabel(owner)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Uploaded by
                  <select
                    value={documentUploader}
                    onChange={(e) => setDocumentUploader(e.target.value)}
                  >
                    <option value="">All uploaders</option>
                    {[
                      ...new Set(packet.documents.map((d) => d.uploaded_by)),
                    ].map((uploader) => (
                      <option key={uploader} value={uploader}>
                        {documentUploaderLabel(uploader)}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="small muted" role="status">
                  {filteredDocuments.length} of {packet.documents.length}{' '}
                  documents
                </span>
                {(documentOwner || documentUploader || search) && (
                  <button
                    onClick={() => {
                      setDocumentOwner('');
                      setDocumentUploader('');
                      setSearch('');
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
              {!filteredDocuments.length && (
                <p>No documents match these filters.</p>
              )}
              {filteredDocuments.map((d) => (
                <button
                  className={`document-row ${sourceDoc?.id === d.id ? 'selected' : ''}`}
                  aria-current={sourceDoc?.id === d.id ? true : undefined}
                  key={d.id}
                  onClick={() =>
                    openEvidence({ ref: d.id, path: ['Documents', d.title] })
                  }
                >
                  <span className="line-code">{d.id}</span>
                  <span>
                    {d.title}
                    <small>
                      {d.page_count} pages · {graph.documentUsage(d.id).length}{' '}
                      linked lines
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
                      setFocusedIssue(null);
                      setSummaryJump({ ref: id, sequence: performance.now() });
                      setTab('Return');
                      setSearch('');
                    } else setEvidence({ ...evidence, ref: id });
                  }}
                />
              ) : (
                <>
                  <h3>{referenceLabel(graph, evidence.ref)}</h3>
                  {resolveReference(evidence.ref, graph) === undefined ? (
                    <p className="callout">
                      Reference not found in the supplied packet. This remains
                      an evidence gap.
                    </p>
                  ) : (
                    <pre>
                      {displayText(
                        graph,
                        JSON.stringify(
                          resolveReference(evidence.ref, graph),
                          (key, value) =>
                            ['rule', 'inputs', 'sources', 'key'].includes(key)
                              ? undefined
                              : value,
                          2,
                        ),
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
