import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  GitCompareArrows,
  LayoutDashboard,
  ListChecks,
  Search,
  ShieldCheck,
  Sprout,
  Undo2,
  X,
} from 'lucide-react';
import { createGraph, money, packet, resolveReference } from './domain/packet';
import { findIssues } from './domain/findings';
import {
  activeEvents,
  canWrite,
  loadReviews,
  STORAGE_KEY,
  validateEvent,
  type ReviewEvent,
} from './domain/review';
import SourceViewer from './components/SourceViewer';
import ReviewForm from './components/ReviewForm';

const sections = [
  ['Overview', LayoutDashboard],
  ['Review queue', ListChecks],
  ['Number explorer', Search],
  ['Evidence library', FileText],
  ['Changes & filing', GitCompareArrows],
] as const;
const initial = loadReviews();
export default function App() {
  const dialogRef = useRef<HTMLElement>(null);
  const [section, setSection] = useState<string>('Overview');
  const [versionId, setVersionId] = useState('v3');
  const [staffId, setStaffId] = useState('st-02');
  const [events, setEvents] = useState(initial.events);
  const [error, setError] = useState(initial.error ?? '');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!selected) return;
    const previouslyFocused = window.document
      .activeElement as HTMLElement | null;
    const roots = [
      ...window.document.querySelectorAll<HTMLElement>('.sidebar, .main-shell'),
    ];
    roots.forEach((root) => (root.inert = true));
    const overflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';
    dialogRef.current
      ?.querySelector<HTMLButtonElement>('[aria-label="Close explorer"]')
      ?.focus();
    return () => {
      roots.forEach((root) => (root.inert = false));
      window.document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, [Boolean(selected)]);
  const [history, setHistory] = useState<string[]>([]);
  const [filter, setFilter] = useState('all');
  const [compare, setCompare] = useState('v2');
  const graph = useMemo(() => createGraph(packet, versionId), [versionId]);
  const findings = useMemo(() => findIssues(graph), [graph]);
  const staff = packet.firm.staff.find((s) => s.id === staffId)!;
  const current = activeEvents(events).filter((e) => e.version === versionId);
  const latest = (target: string, kinds: ReviewEvent['kind'][]) =>
    current.filter((e) => e.target === target && kinds.includes(e.kind)).at(-1);
  const resolved = (id: string) =>
    latest(id, ['resolve', 'reopen'])?.kind === 'resolve';
  const open = findings.filter(
    (f) => f.severity === 'warning' && !resolved(f.id),
  );
  const verified = new Set(
    current.filter((e) => e.kind === 'verify').map((e) => e.target),
  );
  const flags = current.filter((e) => e.kind === 'flag');
  const corrections = current.filter((e) => e.kind === 'adjust');
  const navigate = (id: string) => {
    if (selected) setHistory((h) => [...h, selected]);
    setSelected(id);
  };
  const close = () => {
    setSelected(null);
    setHistory([]);
  };
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
        version: versionId,
      };
      validateEvent(event, staff, events);
      const next = [...events, event];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setEvents(next);
      setError('');
      setNotice('Review record saved on this browser.');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
      return false;
    }
  };
  const exportReviews = () => {
    const blob = new Blob(
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
    );
    const url = URL.createObjectURL(blob),
      link = window.document.createElement('a');
    link.href = url;
    link.download = 'miraflores-review-history.json';
    link.click();
    URL.revokeObjectURL(url);
  };
  const line = selected ? graph.lines.get(selected) : undefined;
  const value = selected ? graph.values.get(selected) : undefined;
  const document = selected
    ? (graph.documents.get(selected) ??
      (value ? graph.documents.get(value.document_id) : undefined))
    : undefined;
  const ref =
    selected && !line && !value && !document
      ? resolveReference(selected, graph)
      : undefined;
  const base = packet.return_versions.find((v) => v.version === compare)!;
  const changes = graph.version.lines.filter(
    (l) => base.lines.find((b) => b.key === l.key)?.value !== l.value,
  );
  const removed = base.lines.filter((l) => !graph.lines.has(l.key));
  const findingCards = (limit?: number) =>
    findings
      .filter(
        (f) =>
          (filter !== 'open' || !resolved(f.id)) &&
          `${f.title} ${f.detail}`.toLowerCase().includes(query.toLowerCase()),
      )
      .slice(0, limit)
      .map((f) => (
        <article className="finding" key={f.id}>
          <div className={`severity ${resolved(f.id) ? 'done' : f.severity}`}>
            {resolved(f.id) ? <Check size={17} /> : <CircleHelp size={17} />}
          </div>
          <div className="finding-body">
            <div className="section-top">
              <span className="eyebrow">{f.origin}</span>
              <span className={`tag ${resolved(f.id) ? 'green' : ''}`}>
                {resolved(f.id)
                  ? 'Resolved'
                  : f.severity === 'warning'
                    ? 'Needs review'
                    : 'Advisory'}
              </span>
            </div>
            <h3>{f.title}</h3>
            <p>{f.detail}</p>
            <div className="chips">
              {f.refs.map((r) => (
                <button key={r} onClick={() => navigate(r)}>
                  {r}
                  <ArrowUpRight size={12} />
                </button>
              ))}
            </div>
            {section === 'Review queue' && (
              <>
                <div className="assignment">
                  <label>
                    Owner
                    <select
                      disabled={!canWrite(staff)}
                      value={latest(f.id, ['assign'])?.note ?? ''}
                      onChange={(e) =>
                        save({
                          kind: 'assign',
                          target: f.id,
                          note: e.target.value,
                        })
                      }
                    >
                      <option value="">Unassigned</option>
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
                </div>
                <form
                  className="resolve"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const note = String(new FormData(form).get('reason'));
                    if (
                      save({
                        kind: resolved(f.id) ? 'reopen' : 'resolve',
                        target: f.id,
                        note,
                      })
                    )
                      form.reset();
                  }}
                >
                  <input
                    name="reason"
                    required
                    aria-label={`Resolution evidence for ${f.title}`}
                    placeholder="Evidence and resolution rationale"
                    disabled={!canWrite(staff)}
                  />
                  <button
                    disabled={
                      !canWrite(staff) ||
                      (!resolved(f.id) && staff.role === 'preparer')
                    }
                  >
                    {resolved(f.id) ? 'Reopen' : 'Resolve'}
                  </button>
                </form>
                {latest(f.id, ['resolve', 'reopen']) && (
                  <p className="small muted">
                    Latest decision: {latest(f.id, ['resolve', 'reopen'])?.note}
                  </p>
                )}
              </>
            )}
          </div>
        </article>
      ));
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setSection('Overview');
          }}
        >
          <Sprout size={29} />
          <span>
            miraflores<span className="brand-sub">WORKPAPERS</span>
          </span>
        </a>
        <div className="workspace-label">CLIENT WORKSPACE</div>
        <div className="client-chip">
          <div className="avatar">OL</div>
          <div>
            Okafor–Lindqvist<small>2025 · Joint return</small>
          </div>
        </div>
        <nav aria-label="Workspace">
          {sections.map(([name, Icon]) => (
            <button
              className={section === name ? 'active' : ''}
              key={name}
              onClick={() => {
                setSection(name);
                setQuery('');
                setFilter('all');
              }}
            >
              <Icon size={18} />
              {name}
              {name === 'Review queue' && (
                <span className="nav-count">{open.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sandbox">
            <ShieldCheck size={18} />
            <div>
              Case study workspace
              <small>Fictional household · Local saves</small>
            </div>
          </div>
          <label className="role-label">
            Viewing as
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
            >
              {packet.firm.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.role.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <p className="small muted">Role simulation, not authentication.</p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            Clients <ChevronRight size={14} /> <span>Okafor–Lindqvist</span>
            <ChevronRight size={14} />
            <strong>2025</strong>
          </div>
          <div>
            <span className="local-dot" /> Browser-local workspace{' '}
            <span className="divider" />{' '}
            <label>
              Return{' '}
              <select
                aria-label="Return version"
                value={versionId}
                onChange={(e) => {
                  setVersionId(e.target.value);
                  close();
                }}
              >
                {packet.return_versions.map((v) => (
                  <option key={v.version}>{v.version}</option>
                ))}
              </select>
            </label>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                TAX YEAR 2025 / {packet.packet.client_id}
              </span>
              <h1>
                {section === 'Overview'
                  ? 'A clear path to a confident return.'
                  : section}
              </h1>
              <p>
                {section === 'Overview'
                  ? 'Okafor–Lindqvist household · Married filing jointly · California → Texas'
                  : section === 'Number explorer'
                    ? 'Follow every number back to the evidence behind it.'
                    : section === 'Evidence library'
                      ? 'Every document, its extracted fields, and everywhere it landed.'
                      : section === 'Review queue'
                        ? 'Investigate the evidence. Record the judgment. Close the loop.'
                        : 'A durable record of what changed, who reviewed it, and what remains.'}
              </p>
            </div>
            <button onClick={exportReviews}>
              Export review history <ArrowUpRight size={15} />
            </button>
          </div>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice('')}
              >
                <X size={14} />
              </button>
            </div>
          )}
          {section === 'Overview' && (
            <>
              <div className="overview-banner">
                <div>
                  <span className="eyebrow">
                    CURRENT ENGINE SNAPSHOT · {versionId.toUpperCase()}
                  </span>
                  <h2>
                    The numbers are in.
                    <br />
                    The evidence needs your eyes.
                  </h2>
                  <p>
                    {open.length} open warning findings · {flags.length}{' '}
                    reviewer flags · {verified.size} items verified
                  </p>
                  <button
                    className="primary"
                    onClick={() => setSection('Review queue')}
                  >
                    Continue review <ArrowRight size={16} />
                  </button>
                </div>
                <div className="banner-art" aria-hidden="true">
                  <div className="art-node">
                    Source evidence <Check size={14} />
                  </div>
                  <div className="art-connector" />
                  <div className="art-node">Connected calculations</div>
                  <div className="art-connector" />
                  <div className="art-node accent">
                    A return you can explain <Sprout size={19} />
                  </div>
                </div>
              </div>
              <div className="metrics">
                {[
                  [
                    'Adjusted gross income',
                    'F1040.11',
                    graph.version.summary.federal.agi,
                  ],
                  [
                    'Federal total tax',
                    'F1040.24',
                    graph.version.summary.federal.total_tax,
                  ],
                  [
                    'Federal balance due',
                    'F1040.37',
                    graph.version.summary.federal.balance_due,
                  ],
                  [
                    'California refund',
                    'F540NR.97',
                    graph.lines.get('F540NR.97')?.value ?? 0,
                  ],
                ].map(([label, key, amount]) => (
                  <button
                    className="metric"
                    key={String(label)}
                    onClick={() => navigate(String(key))}
                  >
                    <span>
                      {label}
                      <ArrowUpRight size={15} />
                    </span>
                    <strong>{money(amount)}</strong>
                    <small>Engine amount · Explore evidence</small>
                  </button>
                ))}
              </div>
              <div className="overview-grid">
                <section className="panel">
                  <div className="section-top">
                    <h2>Start with what matters</h2>
                    <button
                      className="text-button"
                      onClick={() => setSection('Review queue')}
                    >
                      All findings <ArrowRight size={15} />
                    </button>
                  </div>
                  {findingCards(3)}
                </section>
                <section className="panel">
                  <span className="eyebrow">REVIEW READINESS</span>
                  <h2>Evidence before approval.</h2>
                  <div className="readiness">
                    <span className="status-dot" /> Review in progress
                  </div>
                  <p className="muted">
                    Clearing findings is one step. This prototype does not
                    certify filing readiness or transmit returns.
                  </p>
                  <div className="stat-line">
                    <span>Source documents</span>
                    <strong>{packet.documents.length}</strong>
                  </div>
                  <div className="stat-line">
                    <span>Extracted values</span>
                    <strong>
                      {packet.extracted_values.length.toLocaleString()}
                    </strong>
                  </div>
                  <div className="stat-line">
                    <span>Connected tax lines</span>
                    <strong>{graph.lines.size}</strong>
                  </div>
                  <div className="stat-line">
                    <span>Proposed corrections</span>
                    <strong>{corrections.length}</strong>
                  </div>
                  <button
                    className="wide"
                    onClick={() => {
                      setSection('Number explorer');
                      navigate('F1040.1a');
                    }}
                  >
                    Trace wages to the W-2s <ArrowRight size={15} />
                  </button>
                  <p className="small muted">
                    Snapshot computed{' '}
                    {new Date(graph.version.computed_at).toLocaleDateString(
                      'en-US',
                    )}
                    . Later filing events are scripted history.
                  </p>
                </section>
              </div>
            </>
          )}
          {['Number explorer', 'Evidence library', 'Review queue'].includes(
            section,
          ) && (
            <div className="searchbar">
              <Search size={18} />
              <input
                aria-label={`Search ${section}`}
                placeholder={
                  section === 'Evidence library'
                    ? 'Search documents, issuers, or document IDs…'
                    : 'Search labels, forms, amounts, or findings…'
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {section === 'Review queue' && (
                <select
                  aria-label="Finding status"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All findings</option>
                  <option value="open">Open findings</option>
                </select>
              )}
            </div>
          )}
          {section === 'Review queue' && (
            <section className="panel">
              {findingCards()}
              <h3>Reviewer flags</h3>
              {flags.length ? (
                flags.map((f) => (
                  <div className="audit-row" key={f.id}>
                    <button onClick={() => navigate(f.target)}>
                      {f.target}
                    </button>
                    <span>{f.note}</span>
                    <button
                      disabled={f.actor !== staff.id || !canWrite(staff)}
                      onClick={() =>
                        save({
                          kind: 'undo',
                          target: f.target,
                          note: 'Withdrew reviewer flag',
                          reverses: f.id,
                        })
                      }
                    >
                      Withdraw flag
                    </button>
                  </div>
                ))
              ) : (
                <p className="muted">No manual flags in this version.</p>
              )}
            </section>
          )}
          {section === 'Number explorer' && (
            <section className="panel">
              <div className="section-top">
                <h2>
                  Return lines <span className="muted">{graph.lines.size}</span>
                </h2>
                <span className="small muted">
                  Select a line to open its evidence trail
                </span>
              </div>
              <div className="line-list">
                {graph.version.lines
                  .filter((l) =>
                    `${l.key} ${l.label} ${l.value}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((l) => (
                    <button
                      className="line-row"
                      key={l.key}
                      onClick={() => navigate(l.key)}
                    >
                      <span className="line-code">{l.key}</span>
                      <span>
                        {l.label}
                        <small>
                          {l.jurisdiction} · {l.inputs.length} inputs ·{' '}
                          {l.sources.length} source references
                        </small>
                      </span>
                      <strong>{money(l.value)}</strong>
                      <ChevronRight size={15} />
                    </button>
                  ))}
              </div>
            </section>
          )}
          {section === 'Evidence library' && (
            <div className="document-grid">
              {packet.documents
                .filter((d) =>
                  `${d.id} ${d.title} ${d.issuer}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((d) => (
                  <button
                    className="document-card"
                    key={d.id}
                    onClick={() => navigate(d.id)}
                  >
                    <div className="section-top">
                      <FileText size={24} />
                      <span className="tag">{d.id}</span>
                    </div>
                    <h3>{d.title}</h3>
                    <p>{d.issuer}</p>
                    <div className="section-top">
                      <span>
                        {d.page_count} pages ·{' '}
                        {graph.documentUsage(d.id).length} linked lines
                      </span>
                      <ArrowUpRight size={16} />
                    </div>
                    <small>
                      {graph.version.documents_superseded.includes(d.id)
                        ? 'Superseded'
                        : graph.version.documents_used.includes(d.id)
                          ? 'Listed as used by engine'
                          : 'Not used in this snapshot'}
                      {d.marked_corrected ? ' · Corrected' : ''}
                    </small>
                  </button>
                ))}
            </div>
          )}
          {section === 'Changes & filing' && (
            <>
              <section className="panel">
                <div className="section-top">
                  <h2>Compare engine snapshots</h2>
                  <label>
                    Compare {versionId} with{' '}
                    <select
                      value={compare}
                      onChange={(e) => setCompare(e.target.value)}
                    >
                      {packet.return_versions.map((v) => (
                        <option key={v.version}>{v.version}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="muted">
                  {changes.length} added or changed lines · {removed.length}{' '}
                  removed lines. Review overlays do not alter these snapshots.
                </p>
                {changes.map((l) => (
                  <button
                    className="line-row"
                    key={l.key}
                    onClick={() => navigate(l.key)}
                  >
                    <span className="line-code">{l.key}</span>
                    <span>{l.label}</span>
                    <del>
                      {money(base.lines.find((b) => b.key === l.key)?.value)}
                    </del>
                    <ArrowRight size={14} />
                    <strong>{money(l.value)}</strong>
                  </button>
                ))}
                {removed.map((l) => (
                  <div className="line-row" key={l.key}>
                    <span>
                      {l.key} · {l.label}
                    </span>
                    <del>{money(l.value)}</del>
                    <strong>Removed</strong>
                  </div>
                ))}
              </section>
              <section className="panel">
                <h2>Precomputed alternatives</h2>
                <p className="muted">
                  Actual supplied engine results, relative to each scenario’s
                  base version. These do not apply review corrections.
                </p>
                {packet.what_if.alternatives.map((a) => (
                  <div className="scenario" key={a.id}>
                    <div>
                      <strong>{a.description}</strong>
                      <small>Base snapshot {a.base_version}</small>
                    </div>
                    <span>
                      Federal tax Δ {money(a.federal.total_tax_change)}
                      <small>
                        California tax Δ {money(a.california.total_tax_change)}
                      </small>
                    </span>
                  </div>
                ))}
              </section>
              <section className="panel">
                <h2>Review audit history</h2>
                <p className="muted">
                  All versions · immutable local events with compensating undo
                  records.
                </p>
                {!events.length && (
                  <p>No review actions yet. Open a source to begin.</p>
                )}
                {[...events].reverse().map((e) => (
                  <div className="audit-row" key={e.id}>
                    <Clock3 size={16} />
                    <div>
                      <strong>
                        {e.kind} · {e.target}
                      </strong>
                      <p>{e.note}</p>
                      <small>
                        {packet.firm.staff.find((s) => s.id === e.actor)?.name}{' '}
                        · {e.version} · {new Date(e.at).toLocaleString()}
                        {e.method ? ` · ${e.method.replaceAll('_', ' ')}` : ''}
                        {e.kind === 'adjust'
                          ? ` · ${money(e.original)} → ${money(e.amount)} (${e.category})`
                          : ''}
                      </small>
                    </div>
                    {e.kind !== 'undo' &&
                      activeEvents(events).some((a) => a.id === e.id) && (
                        <button
                          aria-label={`Undo ${e.kind} ${e.target}`}
                          disabled={
                            e.actor !== staff.id ||
                            e.version !== versionId ||
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
                          <Undo2 size={15} />
                        </button>
                      )}
                  </div>
                ))}
              </section>
              <section className="panel">
                <h2>
                  Season timeline <span className="tag">Supplied scenario</span>
                </h2>
                <p className="callout">
                  Events after June 23, 2026 are scripted replay data, not
                  actions completed or approvals obtained in this workspace.
                  Filing, signatures, and amendments are not implemented.
                </p>
                {packet.timeline.map((t) => (
                  <div className="timeline-row" key={t.id}>
                    <time>{t.at.slice(0, 10)}</time>
                    <div>
                      <strong>{t.event.replaceAll('_', ' ')}</strong>
                      <div className="chips">
                        {t.refs.map((r) => (
                          <button key={r} onClick={() => navigate(r)}>
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            </>
          )}
          <footer>
            Miraflores workpapers{' '}
            <span>Evidence first. Judgment recorded.</span>
            <span>Prototype · Synthetic data · Saved to this browser</span>
          </footer>
        </main>
      </div>
      {selected && (
        <div className="drawer-backdrop" onClick={close}>
          <aside
            ref={dialogRef}
            className="explorer-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Number explorer"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              if (e.key === 'Tab') {
                const items = [
                  ...(dialogRef.current?.querySelectorAll<HTMLElement>(
                    'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]',
                  ) ?? []),
                ];
                const first = items[0],
                  last = items.at(-1);
                if (e.shiftKey && window.document.activeElement === first) {
                  e.preventDefault();
                  last?.focus();
                } else if (
                  !e.shiftKey &&
                  window.document.activeElement === last
                ) {
                  e.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <div className="drawer-toolbar">
              <button
                disabled={!history.length}
                onClick={() => {
                  setSelected(history.at(-1)!);
                  setHistory((h) => h.slice(0, -1));
                }}
              >
                ← Back
              </button>
              <span>Evidence trail · {versionId}</span>
              <button autoFocus aria-label="Close explorer" onClick={close}>
                <X size={20} />
              </button>
            </div>
            <div className="drawer-content">
              {line && (
                <>
                  <span className="eyebrow">
                    {line.key} · {line.jurisdiction}
                  </span>
                  <h2>{line.label}</h2>
                  <div className="explorer-amount">{money(line.value)}</div>
                  <p className="muted small">
                    Supplied engine value ·{' '}
                    {verified.has(line.key)
                      ? 'Review recorded'
                      : 'Not yet verified'}
                  </p>
                  <div className="rule">
                    <strong>Calculation rule · {line.rule}</strong>
                    <p>
                      {packet.engine_reference.rules[line.rule] ??
                        'Rule description not supplied.'}
                    </p>
                    {line.note && <p>{line.note}</p>}
                  </div>
                  {line.inputs.length > 0 && (
                    <>
                      <h4>Built from</h4>
                      {line.inputs.map((id) => (
                        <button
                          className="input-node"
                          key={id}
                          onClick={() => navigate(id)}
                        >
                          <div>
                            <small>{id}</small>
                            <span>
                              {graph.lines.get(id)?.label ?? 'Unresolved input'}
                            </span>
                          </div>
                          <strong>{money(graph.lines.get(id)?.value)}</strong>
                          <ArrowUpRight size={15} />
                        </button>
                      ))}
                    </>
                  )}
                  <h4>
                    <ArrowDown size={15} /> Supporting evidence (
                    {graph.evidence(line.key).length})
                  </h4>
                  <div className="chips">
                    {graph.evidence(line.key).map((id) => (
                      <button key={id} onClick={() => navigate(id)}>
                        {id}
                        <ArrowUpRight size={12} />
                      </button>
                    ))}
                  </div>
                  {!graph.evidence(line.key).length && (
                    <p className="callout">
                      No source reference supplied. Review the rule and document
                      the evidence manually.
                    </p>
                  )}
                </>
              )}
              {value && (
                <>
                  <span className="eyebrow">EXTRACTED VALUE · {value.id}</span>
                  <h2>{value.label}</h2>
                  <div className="explorer-amount">
                    {value.value_type === 'money'
                      ? money(value.value)
                      : String(value.value)}
                  </div>
                  <p className="muted">
                    {Math.round(value.confidence * 100)}% extraction confidence
                    ≠ verification
                  </p>
                  <div className="chips">
                    {graph.downstream(value.id).map((key) => (
                      <button key={key} onClick={() => navigate(key)}>
                        {key}
                        <ArrowUpRight size={12} />
                      </button>
                    ))}
                  </div>
                </>
              )}
              {document && (
                <SourceViewer
                  key={`${document.id}-${value?.id ?? ''}`}
                  graph={graph}
                  documentId={document.id}
                  value={value}
                  onReference={navigate}
                />
              )}
              {!line && !value && !document && (
                <>
                  <span className="eyebrow">REFERENCE</span>
                  <h2>{selected}</h2>
                  {ref === undefined ? (
                    <p className="callout">
                      This reference could not be resolved from the supplied
                      packet. It remains an explicit evidence gap.
                    </p>
                  ) : (
                    <pre className="reference-json">
                      {JSON.stringify(ref, null, 2)}
                    </pre>
                  )}
                </>
              )}
              {(line || value || document) && (
                <ReviewForm
                  key={`${selected}-${staffId}-${versionId}`}
                  target={selected}
                  graph={graph}
                  staff={staff}
                  onSave={save}
                />
              )}
              {current.filter((e) => e.target === selected).length > 0 && (
                <section>
                  <h4>Recorded on this item</h4>
                  {current
                    .filter((e) => e.target === selected)
                    .map((e) => (
                      <div className="item-note" key={e.id}>
                        <strong>
                          {e.kind}
                          {e.kind === 'adjust'
                            ? ` · ${money(e.original)} → ${money(e.amount)}`
                            : ''}
                        </strong>
                        <p>{e.note}</p>
                        <small>
                          {
                            packet.firm.staff.find((s) => s.id === e.actor)
                              ?.name
                          }{' '}
                          · {new Date(e.at).toLocaleString()}
                        </small>
                      </div>
                    ))}
                </section>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
