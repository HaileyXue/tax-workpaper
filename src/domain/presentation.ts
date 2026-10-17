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
