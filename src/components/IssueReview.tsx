import { packet, type Staff } from '../domain/packet';
import { canWrite, type ReviewEvent } from '../domain/review';
import type { Finding } from '../domain/findings';
import type { SaveEvent } from './Exceptions';
export default function IssueReview({
  finding: f,
  events,
  staff,
  save,
  resolved,
}: {
  finding: Finding;
  events: ReviewEvent[];
  staff: Staff;
  save: SaveEvent;
  resolved: (id: string) => boolean;
}) {
  return (
    <details className="contextual-review">
      <summary>Decision & assignment</summary>{' '}
      <label className="owner">
        Owner
        <select
          disabled={!canWrite(staff)}
          value={
            events
              .filter((e) => e.target === f.id && e.kind === 'assign')
              .at(-1)?.note ?? ''
          }
          onChange={(e) =>
            save({ kind: 'assign', target: f.id, note: e.target.value })
          }
        >
          <option value="Unassigned">Unassigned</option>
          {packet.firm.staff
            .filter((s) => ['preparer', 'reviewer', 'partner'].includes(s.role))
            .map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
        </select>
      </label>
      <form
        className="resolve"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          if (
            save({
              kind: resolved(f.id) ? 'reopen' : 'resolve',
              target: f.id,
              note: String(new FormData(form).get('reason')),
            })
          )
            form.reset();
        }}
      >
        <label>
          Resolution evidence
          <textarea
            name="reason"
            required
            placeholder="Explain the decision and supporting evidence."
            disabled={!canWrite(staff)}
          />
        </label>
        <button
          disabled={
            !canWrite(staff) || (!resolved(f.id) && staff.role === 'preparer')
          }
        >
          {resolved(f.id) ? 'Reopen issue' : 'Resolve issue'}
        </button>
      </form>
      {events
        .filter(
          (e) => e.target === f.id && ['resolve', 'reopen'].includes(e.kind),
        )
        .slice(-1)
        .map((e) => (
          <p className="item-note" key={e.id}>
            {e.note}
          </p>
        ))}
    </details>
  );
}
