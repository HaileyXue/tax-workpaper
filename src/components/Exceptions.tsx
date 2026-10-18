import { ArrowRight } from 'lucide-react';
import type { ReviewEvent } from '../domain/review';
import type { Finding } from '../domain/findings';
export type SaveEvent = (
  event: Omit<ReviewEvent, 'id' | 'at' | 'actor' | 'role' | 'version'>,
) => boolean;
export default function Exceptions({
  findings,
  resolved,
  onNavigate,
}: {
  findings: Finding[];
  resolved: (id: string) => boolean;
  onNavigate: (finding: Finding) => void;
}) {
  return (
    <div className="findings">
      {findings.map((f) => (
        <button
          key={f.id}
          className="finding-link"
          data-finding-id={f.id}
          data-severity={f.severity}
          data-resolved={resolved(f.id)}
          onClick={() => onNavigate(f)}
        >
          <span
            className={`status-dot ${resolved(f.id) ? 'done' : f.severity}`}
          />
          <span>{f.title}</span>
          <small>
            {resolved(f.id)
              ? 'Resolved'
              : f.severity === 'warning'
                ? 'Go to issue'
                : 'View advisory'}
          </small>
          <ArrowRight className="finding-arrow" size={15} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
