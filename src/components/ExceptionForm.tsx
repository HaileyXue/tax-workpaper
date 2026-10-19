import { referenceLabel } from '../domain/presentation';
import { useState } from 'react';
import { money, type Graph, type Staff } from '../domain/packet';
import { canWrite, estimateImpact, type ReviewEvent } from '../domain/review';
import type { Finding } from '../domain/findings';

export default function ExceptionForm({
  target,
  graph,
  staff,
  onSave,
  kind,
  onCancel,
  finding,
}: {
  kind: 'flag' | 'adjust' | 'note';
  onCancel: () => void;
  target: string;
  graph: Graph;
  staff: Staff;
  finding?: Finding;
  onSave: (
    event: Omit<ReviewEvent, 'id' | 'at' | 'actor' | 'role' | 'version'>,
  ) => boolean;
}) {
  const [note, setNote] = useState('');
  const original =
    graph.values.get(target)?.value ?? graph.lines.get(target)?.value;
  const suggested =
    finding?.correction?.target === target ? finding.correction : undefined;
  const [amount, setAmount] = useState(
    suggested ? String(suggested.proposedValue) : '',
  );
  const [category, setCategory] = useState(suggested?.category ?? '');
  const numeric = typeof original === 'number';
  const entered = Number(amount);
  const taxableDelta =
    suggested && Number.isFinite(entered)
      ? -(entered - Number(original))
      : numeric && Number.isFinite(entered)
        ? entered - original
        : undefined;
  const proposedTaxableAmount =
    suggested && taxableDelta !== undefined
      ? suggested.originalTaxableAmount + taxableDelta
      : undefined;
  const impact =
    kind === 'adjust' &&
    numeric &&
    amount.trim() &&
    Number.isFinite(Number(amount)) &&
    category
      ? estimateImpact(
          graph.version,
          category,
          taxableDelta ?? Number(amount) - original,
        )
      : undefined;
  const affected = graph.downstream(target);
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
              ? {
                  amount: Number(amount),
                  original,
                  category,
                  ...(finding ? { findingId: finding.id } : {}),
                  ...(suggested
                    ? {
                        evidenceRefs: suggested.evidenceRefs,
                        affectedLine: suggested.affectedLine,
                        originalTaxableAmount: suggested.originalTaxableAmount,
                        proposedTaxableAmount,
                        taxableDelta,
                      }
                    : {}),
                }
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
            {suggested && proposedTaxableAmount !== undefined && (
              <div className="correction-preview">
                <span>Source correction</span>
                <strong>
                  {money(original)} → {money(entered)} basis
                </strong>
                <span>Affected sale</span>
                <strong>
                  {money(suggested.originalTaxableAmount)} →{' '}
                  {money(proposedTaxableAmount)} proposed gain
                </strong>
                <span>Estimated taxable change</span>
                <strong>{money(taxableDelta)}</strong>
              </div>
            )}
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
            {affected.length > 0 && (
              <details className="affected-lines">
                <summary>{affected.length} affected tax lines</summary>
                <ul>
                  {affected.slice(0, 12).map((id) => (
                    <li key={id}>{graph.lines.get(id)?.label}</li>
                  ))}
                </ul>
                {affected.length > 12 && (
                  <p className="small muted">
                    And {affected.length - 12} additional downstream lines.
                  </p>
                )}
              </details>
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
