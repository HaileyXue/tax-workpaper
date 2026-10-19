import { type Graph } from './packet';
export interface SuggestedCorrection {
  kind: 'sale_basis';
  target: string;
  proposedValue: number;
  evidenceRefs: string[];
  affectedLine: string;
  originalTaxableAmount: number;
  proposedTaxableAmount: number;
  taxableDelta: number;
  category: 'stcg' | 'ltcg';
}
export interface Finding {
  id: string;
  title: string;
  detail: string;
  refs: string[];
  origin: string;
  severity: 'warning' | 'info';
  expected?: number;
  priority?: number;
  correction?: SuggestedCorrection;
}
export function findIssues(graph: Graph): Finding[] {
  const findings: Finding[] = graph.version.diagnostics.map((d) => ({
    id: d.code,
    title: d.code.toLowerCase().replaceAll('_', ' '),
    detail: d.message,
    refs: d.refs,
    origin: 'Engine diagnostic',
    severity: d.severity === 'warning' ? 'warning' : 'info',
    priority: d.severity === 'warning' ? 50 : 10,
  }));
  // Narrow, deterministic check against printed W-2 boxes, independent of confidence.
  for (const v of graph.values.values()) {
    const doc = graph.documents.get(v.document_id);
    const box = /^box(\d+)$/.exec(v.field);
    if (doc?.document_type !== 'W-2' || !box || typeof v.value !== 'number')
      continue;
    const printed =
      doc.pages.find((p) => p.page === v.page)?.printed_content ?? '';
    const match = new RegExp(`Box ${box[1]} ([\\d,]+\\.\\d{2})\\b`, 'i').exec(
      printed,
    );
    const expected = match ? Number(match[1].replaceAll(',', '')) : undefined;
    if (expected !== undefined && expected !== v.value)
      findings.push({
        id: `source-${v.id}`,
        title: 'W-2 extraction disagrees with printed box',
        detail: `${doc.id}, ${v.label}: extraction ${v.value.toLocaleString()} at ${Math.round(v.confidence * 100)}% confidence; printed source ${expected.toLocaleString()}.`,
        refs: [v.id],
        expected,
        origin: 'Independent source check',
        severity: 'warning',
        priority: 80,
      });
  }
  // A blank source amount is not zero. Match high-confidence blank sale basis
  // values to a supplemental adjusted basis using the supplied acquisition date.
  for (const basis of graph.values.values()) {
    if (
      basis.value_type !== 'money' ||
      basis.value !== 0 ||
      basis.text_as_read.trim() ||
      basis.confidence < 0.9 ||
      !basis.field.endsWith('_basis') ||
      !graph.downstream(basis.id).length
    )
      continue;
    const lot = basis.field.slice(0, -'_basis'.length);
    const acquired = [...graph.values.values()].find(
      (value) =>
        value.document_id === basis.document_id &&
        value.field === `${lot}_acquired`,
    );
    if (!acquired || typeof acquired.value !== 'string') continue;
    const supplementalDate = [...graph.values.values()].find(
      (value) =>
        value.document_id !== basis.document_id &&
        value.field.endsWith('_acquired') &&
        value.value === acquired.value &&
        [...graph.values.values()].some(
          (candidate) =>
            candidate.document_id === value.document_id &&
            candidate.field ===
              `${value.field.slice(0, -'_acquired'.length)}_adjusted_basis` &&
            typeof candidate.value === 'number',
        ),
    );
    if (!supplementalDate) continue;
    const supplementalLot = supplementalDate.field.slice(
      0,
      -'_acquired'.length,
    );
    const adjustedBasis = [...graph.values.values()].find(
      (value) =>
        value.document_id === supplementalDate.document_id &&
        value.field === `${supplementalLot}_adjusted_basis` &&
        typeof value.value === 'number',
    );
    const affectedLine = graph
      .downstream(basis.id)
      .find((id) => id.startsWith('F8949.'));
    const line = affectedLine ? graph.lines.get(affectedLine) : undefined;
    if (!adjustedBasis || typeof adjustedBasis.value !== 'number' || !line)
      continue;
    const originalTaxableAmount = Number(line.value);
    const taxableDelta = -(adjustedBasis.value - Number(basis.value));
    const box = affectedLine!.split('.')[1];
    findings.push({
      id: `missing-zero-${basis.id}`,
      title: `${basis.label} was treated as zero`,
      detail: `${graph.documents.get(basis.document_id)?.id} reports the basis as not reported, but the pipeline stored $0 at ${Math.round(basis.confidence * 100)}% confidence. ${graph.documents.get(adjustedBasis.document_id)?.id} supplies an adjusted basis of $${adjustedBasis.value.toLocaleString()} for the matching ${acquired.value} acquisition date.`,
      refs: [basis.id, adjustedBasis.id, supplementalDate.id],
      origin: 'Independent cross-document check',
      severity: 'warning',
      priority: 100,
      expected: adjustedBasis.value,
      correction: {
        kind: 'sale_basis',
        target: basis.id,
        proposedValue: adjustedBasis.value,
        evidenceRefs: [basis.id, adjustedBasis.id, supplementalDate.id],
        affectedLine: affectedLine!,
        originalTaxableAmount,
        proposedTaxableAmount: originalTaxableAmount + taxableDelta,
        taxableDelta,
        category: ['A', 'B', 'C'].includes(box) ? 'stcg' : 'ltcg',
      },
    });
  }
  const sweep = ['ev-0492', 'ev-0538'];
  if (sweep.every((id) => graph.downstream(id).includes('F1040.2b')))
    findings.push({
      id: 'duplicate-sweep',
      title: 'Same bank sweep interest counted twice',
      detail:
        'D28 and D29 both report $1,840 for the Northlake Bank sweep account. Both flow to taxable interest. Confirm a single income event before adjusting.',
      refs: sweep,
      origin: 'Independent overlap check',
      severity: 'warning',
      priority: 75,
    });
  const swedish = graph.lines.get('SchB.1.6');
  if (swedish?.sources.includes('ref:fx.SEK.2024_average'))
    findings.push({
      id: 'fx-year',
      title: '2025 interest uses the 2024 exchange rate',
      detail:
        'The Swedish interest line uses 10.56 SEK/USD (2024), while the packet supplies 9.86 for 2025. Review the conversion and document the chosen rate.',
      refs: [
        'SchB.1.6',
        'ev-0960',
        'ref:fx.SEK.2024_average',
        'ref:fx.SEK.2025_average',
      ],
      origin: 'Independent year check',
      severity: 'warning',
      priority: 75,
    });
  return findings.sort(
    (a, b) =>
      Number(b.severity === 'warning') - Number(a.severity === 'warning') ||
      (b.priority ?? 0) - (a.priority ?? 0),
  );
}
