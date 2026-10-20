import type { Graph } from './packet';
import type { Finding } from './findings';

// These are semantic mappings to supplied line IDs, never replacement figures.
export const summaryRows = [
  { label: 'Total income', federal: 'F1040.9' },
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
  const matches = relevantFindings(graph, findings, [ref]);
  if (!matches.length) return undefined;
  const direct = matches.some((f) => f.refs.includes(ref));
  return {
    kind: direct ? 'direct' : 'upstream',
    description: `${direct ? 'Issue to resolve' : 'Affected by an issue'}: ${matches.map((f) => f.title).join('; ')}`,
  };
}

export const summaryRoots = summaryRows
  .flatMap((r) => [
    'federal' in r ? r.federal : undefined,
    'california' in r ? r.california : undefined,
  ])
  .filter((r): r is string => Boolean(r));

export function referencePath(
  graph: Graph,
  root: string,
  target: string,
): string[] | undefined {
  const seen = new Set<string>();
  function visit(id: string): string[] | undefined {
    if (id === target) return [id];
    if (seen.has(id)) return;
    seen.add(id);
    const line = graph.lines.get(id);
    for (const child of [...(line?.inputs ?? []), ...(line?.sources ?? [])]) {
      const path = visit(child);
      if (path) return [id, ...path];
    }
  }
  return visit(root);
}

export function additionalRecords(graph: Graph) {
  const seen = new Set<string>();
  function visit(id: string) {
    if (seen.has(id)) return;
    seen.add(id);
    const line = graph.lines.get(id);
    [...(line?.inputs ?? []), ...(line?.sources ?? [])].forEach(visit);
  }
  summaryRoots.forEach(visit);
  return [...graph.lines.values()].filter((line) => !seen.has(line.key));
}

export function summaryLocation(graph: Graph, target: string) {
  for (const root of summaryRoots) {
    const path = referencePath(graph, root, target);
    if (path) return { root, path, additional: false };
  }
  const records = additionalRecords(graph);
  const direct = records.find((line) => line.key === target);
  if (direct) return { root: direct.key, path: [target], additional: true };
  for (const line of records) {
    const path = referencePath(graph, line.key, target);
    if (path) return { root: line.key, path, additional: true };
  }
  return { root: target, path: [target], additional: true };
}

/** Place an issue at the calculation level where a reviewer encounters it.
 * A source-backed detail row is reviewed within its immediate rollup, while a
 * diagnostic attached directly to a calculation stays on that calculation. */
export function findingReviewLine(graph: Graph, finding: Finding) {
  for (const ref of finding.refs) {
    const location = summaryLocation(graph, ref);
    const calculations = location.path.filter((id) => graph.lines.has(id));
    const direct = calculations.at(-1);
    if (!direct) continue;
    const line = graph.lines.get(direct)!;
    if (
      line.inputs.length === 0 &&
      line.sources.length > 0 &&
      calculations.length > 1
    )
      return calculations.at(-2);
    return direct;
  }
}
