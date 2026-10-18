import { referenceLabel } from '../domain/presentation';
import { useState } from 'react';
import { money, type Graph, type Staff } from '../domain/packet';
import { canWrite, estimateImpact, type ReviewEvent } from '../domain/review';

export default function ExceptionForm({
  target,
  graph,
  staff,
  onSave,
  kind,
  onCancel,
}: {
  kind: 'flag' | 'adjust' | 'note';
  onCancel: () => void;
  target: string;
  graph: Graph;
  staff: Staff;
  onSave: (
    event: Omit<ReviewEvent, 'id' | 'at' | 'actor' | 'role' | 'version'>,
  ) => boolean;
}) {
  const [note, setNote] = useState('');
  const original =
    graph.values.get(target)?.value ?? graph.lines.get(target)?.value;
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const numeric = typeof original === 'number';
  const impact =
    kind === 'adjust' &&
    numeric &&
    amount.trim() &&
    Number.isFinite(Number(amount)) &&
    category
      ? estimateImpact(graph.version, category, Number(amount) - original)
      : undefined;
  return (
    <form
      className="review-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (kind === 'adjust' && (!amount.trim() || !category)) return;
        if (
          onSave({
            kind,
            target,
            note,
            ...(kind === 'adjust' && numeric
              ? { amount: Number(amount), original, category }
              : {}),
          })
        ) {
          setNote('');
          setAmount('');
        }
      }}
    >
      <h3>
        {kind === 'adjust'
          ? 'Propose correction'
          : kind === 'flag'
            ? 'Flag issue'
            : 'Add note'}
      </h3>
      <p className="small muted">
        {referenceLabel(graph, target)} · {graph.version.version} · {staff.name}
      </p>
      <fieldset disabled={!canWrite(staff)}>
        {kind === 'adjust' && (
          <>
            <label>
              Corrected value (original: {money(original)})
              <input
                required
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Tax-effect category
              <select
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">
                  Select category after reviewing context
                </option>
                {Object.keys(graph.version.tax_effect_rates).map((c) => (
                  <option key={c} value={c}>
                    {c.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <p className="callout">
              Estimate only. Confirm currency, sign, California sourcing, and
              category. Rates assume a direct USD taxable-income change; do not
              apply them to foreign-currency amounts or intermediate inputs
              without conversion.
            </p>
            {impact && (
              <div className="estimate">
                <strong>Estimated tax change</strong>
                <span>
                  Federal {money(impact.federal)} · California{' '}
                  {money(impact.california)}
                </span>
                <small>
                  Engine totals remain unchanged. Large changes can cross
                  thresholds; business adjustments may also affect QBI.
                </small>
              </div>
            )}
          </>
        )}
        <label>
          Evidence and reason
          <textarea
            required
            rows={3}
            placeholder="What did you check? Cite the field, document, or authority supporting your decision."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button className="primary" type="submit">
          Save{' '}
          {kind === 'adjust' ? 'proposal' : kind === 'flag' ? 'issue' : 'note'}
        </button>
      </fieldset>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
      {!canWrite(staff) && (
        <p className="callout">
          This role has read-only access to review records.
        </p>
      )}
    </form>
  );
}
