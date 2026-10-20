import { ArrowRight } from 'lucide-react';
import { packet } from '../domain/packet';
import { findingIdForEvent, type ReviewEvent } from '../domain/review';
import type { Finding } from '../domain/findings';
export type SaveEvent = (
  event: Omit<ReviewEvent, 'id' | 'at' | 'actor' | 'role' | 'version'>,
) => boolean;
export default function Exceptions({
  findings,
  resolved,
  events,
  onNavigate,
}: {
  findings: Finding[];
  resolved: (id: string) => boolean;
  events: ReviewEvent[];
  onNavigate: (finding: Finding) => void;
}) {
  const eventLabel = (event: ReviewEvent) => {
    const labels: Partial<Record<ReviewEvent['kind'], string>> = {
      assign: `Assigned to ${event.note}`,
      adjust: 'Correction proposed',
      approve: 'Correction approved',
      return: 'Correction returned',
      reject: 'Correction rejected',
      resolve: 'Issue completed',
      reopen: 'Issue reopened',
    };
    return labels[event.kind] ?? event.kind;
  };
  return (
    <div className="findings">
      {findings.map((finding) => {
        const history = events.filter(
          (event) => findingIdForEvent(events, event) === finding.id,
        );
        return (
          <article className="finding-list-item" key={finding.id}>
            <button
              className="finding-link"
              data-finding-id={finding.id}
              data-severity={finding.severity}
              data-resolved={resolved(finding.id)}
              onClick={() => onNavigate(finding)}
            >
              <span
                className={`status-dot ${resolved(finding.id) ? 'done' : finding.severity}`}
              />
              <span>{finding.title}</span>
              <small>
                {resolved(finding.id)
                  ? 'Approved'
                  : finding.severity === 'warning'
                    ? 'Go to issue'
                    : 'View advisory'}
              </small>
              <ArrowRight
                className="finding-arrow"
                size={15}
                aria-hidden="true"
              />
            </button>
            <div className="finding-history" aria-label="Issue history">
              {history.length ? (
                history.slice(-3).map((event) => (
                  <p key={event.id}>
                    <span>{eventLabel(event)}</span>
                    <small>
                      {packet.firm.staff.find(
                        (person) => person.id === event.actor,
                      )?.name ?? 'System'}{' '}
                      · {new Date(event.at).toLocaleString()}
                    </small>
                  </p>
                ))
              ) : (
                <p className="muted">No review activity yet.</p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
