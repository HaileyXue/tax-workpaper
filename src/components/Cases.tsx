import { ArrowRight, FolderOpen } from 'lucide-react';
import { createGraph, packet } from '../domain/packet';
import { findIssues } from '../domain/findings';
import { activeEvents, signoffState, type ReviewEvent } from '../domain/review';

export default function Cases({
  events,
  onOpen,
  error,
}: {
  events: ReviewEvent[];
  onOpen: (version: string) => void;
  error: string;
}) {
  // The delivered packet contains one reviewable case. Related returns are not
  // separate case packets and must not be presented as available workspaces.
  const cases = [packet];
  return (
    <>
      <aside className="app-sidebar" aria-label="Workspace sidebar">
        <a className="brand" href="#">
          Tax workpaper
        </a>
        <nav aria-label="Workspace">
          <button aria-current="page">
            <FolderOpen size={17} />
            Cases
          </button>
        </nav>
      </aside>
      <div className="workspace">
        <main>
          <header className="page-heading">
            <div>
              <h1>Cases</h1>
              <p>Select a case to review its return and supporting evidence.</p>
            </div>
          </header>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <section aria-label="Available cases" className="case-list">
            {cases.map((data) => {
              const version = data.return_versions.at(-1)!.version;
              const graph = createGraph(data, version);
              const current = activeEvents(events).filter(
                (e) => e.version === version,
              );
              const warnings = findIssues(graph).filter(
                (f) =>
                  f.severity === 'warning' &&
                  current
                    .filter(
                      (e) =>
                        e.target === f.id &&
                        ['resolve', 'reopen'].includes(e.kind),
                    )
                    .at(-1)?.kind !== 'resolve',
              ).length;
              const count = signoffState(events, version, warnings).blockers;
              return (
                <article className="case-card" key={data.packet.client_id}>
                  <div className="case-description">
                    <h2>{data.packet.name}</h2>
                    <p>
                      {data.packet.client_id} · Version {version}
                    </p>
                  </div>
                  <span
                    className={`case-issue-badge ${count > 0 ? 'has-issues' : ''}`}
                    role="status"
                  >
                    {count} {count === 1 ? 'issue' : 'issues'} to resolve
                  </span>
                  <button className="primary" onClick={() => onOpen(version)}>
                    Open case <ArrowRight size={16} />
                  </button>
                </article>
              );
            })}
          </section>
          <p className="case-count">
            {cases.length} {cases.length === 1 ? 'case' : 'cases'}
          </p>
        </main>
      </div>
    </>
  );
}
