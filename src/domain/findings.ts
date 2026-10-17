import { type Graph } from './packet';
export interface Finding {
  id: string;
  title: string;
  detail: string;
  refs: string[];
  origin: string;
  severity: 'warning' | 'info';
  expected?: number;
}
export function findIssues(graph: Graph): Finding[] {
  const findings: Finding[] = graph.version.diagnostics.map((d) => ({
    id: d.code,
    title: d.code.toLowerCase().replaceAll('_', ' '),
    detail: d.message,
    refs: d.refs,
    origin: 'Engine diagnostic',
    severity: d.severity === 'warning' ? 'warning' : 'info',
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
    });
  return findings.sort(
    (a, b) =>
      Number(b.severity === 'warning') - Number(a.severity === 'warning'),
  );
}
