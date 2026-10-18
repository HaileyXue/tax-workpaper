import type { Graph, TaxLine } from './packet';

/** Collapse only explicit, unchanged carry/sum links. Preserve every skipped line
 * in the presentation trail; do not infer equivalence from equal amounts alone. */
export function calculationPresentation(graph: Graph, key: string) {
  const chain: TaxLine[] = [];
  const seen = new Set<string>();
  let line = graph.lines.get(key);
  while (line && !seen.has(line.key)) {
    seen.add(line.key);
    chain.push(line);
    if (
      line.inputs.length !== 1 ||
      line.sources.length ||
      !['R-CARRY', 'R-SUM'].includes(line.rule)
    )
      break;
    const next = graph.lines.get(line.inputs[0]);
    if (!next || next.value !== line.value || seen.has(next.key)) break;
    line = next;
  }
  const detail = chain.at(-1);
  // A few direct references are more useful visible than behind another click.
  const expandable = Boolean(
    detail && (detail.inputs.length > 0 || detail.sources.length > 3),
  );
  return { chain, detail, expandable };
}

/** Human labels only; internal graph references remain in the data layer. */
export function referenceLabel(graph: Graph, ref: string): string {
  return (
    graph.lines.get(ref)?.label ??
    graph.values.get(ref)?.label ??
    graph.documents.get(ref)?.title ??
    (ref.startsWith('qa-')
      ? 'Client answer'
      : ref.startsWith('py:')
        ? 'Prior-year record'
        : ref.startsWith('ref:')
          ? 'Calculation assumption'
          : ref.startsWith('agency:')
            ? 'Tax agency record'
            : ref.startsWith('asset:')
              ? 'Asset record'
              : 'Supporting record')
  );
}

export function displayText(graph: Graph, text: string): string {
  return text.replace(
    /\b(?:F\d+[A-Za-z]*|Sch[A-Za-z0-9_-]+)\.[A-Za-z0-9_.-]+/g,
    (ref) => referenceLabel(graph, ref),
  );
}
