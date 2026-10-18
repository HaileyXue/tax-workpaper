import type { Graph } from './packet';
import type { Finding } from './findings';

export interface ScheduleRow {
  id: string;
  label: string;
  documentId?: string;
  cells: Record<string, string | undefined>;
}
// These are semantic mappings to supplied line IDs, never replacement figures.
export const summaryRows = [
  {
    label: 'Adjusted gross income',
    federal: 'F1040.11',
    california: 'F540NR.17',
    note: 'California shows total AGI under California law, before allocation.',
  },
  {
    label: 'Deductions',
    federal: 'F1040.14',
    california: 'F540NR.18',
    note: 'Federal includes QBI. California shows deductions before its allocation percentage.',
  },
  {
    label: 'Total taxable income',
    federal: 'F1040.15',
    california: 'F540NR.19',
    note: 'California uses total taxable income to determine its tax rate.',
  },
  { label: 'California-source AGI', california: 'F540NR.32' },
  {
    label: 'California taxable income after allocation',
    california: 'F540NR.35',
  },
  { label: 'Total tax', federal: 'F1040.24', california: 'F540NR.64' },
  {
    label: 'Income tax withheld',
    federal: 'F1040.25d',
    california: 'F540NR.71',
  },
  { label: 'Total payments', federal: 'F1040.33', california: 'F540NR.78' },
  { label: 'Balance due', federal: 'F1040.37' },
  { label: 'Overpaid tax', california: 'F540NR.97' },
] satisfies {
  label: string;
  federal?: string;
  california?: string;
  note?: string;
}[];

function numericLines(graph: Graph, pattern: RegExp) {
  return [...graph.lines.values()].filter((l) => pattern.test(l.key));
}
export function wagesAndInterest(graph: Graph): ScheduleRow[] {
  // Include W-2 fields only when they are explicitly linked to the selected return.
  // This excludes D10's duplicate image without making an issuer-name assumption.
  const byDoc = new Map<string, ScheduleRow>();
  for (const [column, key] of Object.entries({
    wages: 'F1040.1a',
    withholding: 'F1040.25a',
    stateWithholding: 'F540NR.71',
  })) {
    for (const ref of graph.evidence(key)) {
      const value = graph.values.get(ref);
      const doc = value && graph.documents.get(value.document_id);
      if (!value || !doc || doc.document_type !== 'W-2') continue;
      const row = byDoc.get(doc.id) ?? {
        id: doc.id,
        label: doc.issuer,
        documentId: doc.id,
        cells: {},
      };
      row.cells[column] = ref;
      byDoc.set(doc.id, row);
    }
  }
  return [
    ...byDoc.values(),
    ...numericLines(graph, /^SchB\.1\.\d+$/).map((line) => ({
      id: line.key,
      label: line.label.replace(/^Interest - /, ''),
      documentId: line.sources
        .map((id) => graph.values.get(id)?.document_id)
        .find(Boolean),
      cells: { interest: line.key },
    })),
  ];
}
export function dividends(graph: Graph): ScheduleRow[] {
  return numericLines(graph, /^SchB\.5\.\d+$/).map((line) => ({
    id: line.key,
    label: line.label.replace(/^Ordinary dividends - /, ''),
    documentId: line.sources
      .map((id) => graph.values.get(id)?.document_id)
      .find(Boolean),
    cells: {
      ordinary: line.key,
      qualified: line.sources.find((id) =>
        graph.values.get(id)?.label.toLowerCase().includes('qualified'),
      ),
    },
  }));
}
export function relevantFindings(
  graph: Graph,
  findings: Finding[],
  refs: string[],
): Finding[] {
  const evidence = new Set(
    refs.flatMap((ref) => (graph.lines.has(ref) ? graph.evidence(ref) : [ref])),
  );
  return findings.filter((f) =>
    f.refs.some(
      (ref) =>
        refs.includes(ref) ||
        evidence.has(ref) ||
        graph.downstream(ref).some((id) => refs.includes(id)),
    ),
  );
}

export function amountIssue(graph: Graph, findings: Finding[], ref: string) {
  // Highlight only the reference explicitly identified by the finding. Never
  // propagate an issue color to a consumer or infer that its inputs are wrong.
  const matches = findings.filter((finding) => finding.refs.includes(ref));
  if (!matches.length) return undefined;
  return {
    kind: 'direct',
    description: `Issue to resolve: ${matches.map((f) => f.title).join('; ')}`,
  };
}

export function scheduleDestination(graph: Graph, refs: string[]) {
  for (const [view, rows] of [
    ['Wages & interest', wagesAndInterest(graph)],
    ['Dividends', dividends(graph)],
  ] as const) {
    for (const row of rows)
      for (const ref of Object.values(row.cells)) {
        if (
          ref &&
          refs.some(
            (id) => id === ref || graph.lines.get(ref)?.sources.includes(id),
          )
        )
          return { view, ref };
      }
  }
  return undefined;
}
