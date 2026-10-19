import {
  amountIssue,
  summaryLocation,
  additionalRecords,
  referencePath,
  summaryRoots,
  summaryRows,
  relevantFindings,
} from '../src/domain/schedules';
import { calculationPresentation } from '../src/domain/presentation';
import { describe, expect, it } from 'vitest';
import { createGraph, packet, resolveReference } from '../src/domain/packet';
import { findIssues } from '../src/domain/findings';
import {
  signoffState,
  validateSignoff,
  activeEvents,
  estimateImpact,
  proposalDecision,
  validateEvent,
  type ReviewEvent,
} from '../src/domain/review';
const graph = createGraph(packet, 'v3');
const reviewer = packet.firm.staff.find((s) => s.role === 'reviewer')!;
const event: ReviewEvent = {
  id: 'test',
  at: '2026-10-17T00:00:00Z',
  actor: reviewer.id,
  role: reviewer.role,
  version: 'v3',
  kind: 'verify',
  target: 'ev-0016',
  note: 'Agreed to D08 box 1',
  method: 'agreed_to_source_document',
};

describe('packet lineage', () => {
  it('preserves the full delivered fixture', () => {
    expect(packet.documents).toHaveLength(74);
    expect(packet.extracted_values).toHaveLength(3012);
    expect(graph.lines.size).toBe(627);
  });
  it('traces total wages through its calculation to both exact W-2 fields', () => {
    expect(graph.evidence('F1040.1z')).toEqual(['ev-0016', 'ev-0035']);
    expect(graph.values.get('ev-0016')).toMatchObject({
      document_id: 'D08',
      page: 1,
      field: 'box1',
      value: 104600,
    });
    expect(graph.documents.get('D08')?.pages[0].printed_content).toContain(
      'Box 1 104,600.00',
    );
    expect(graph.downstream('ev-0016')).toContain('F1040.11');
    expect(graph.documentUsage('D08')).toContain('F1040.1z');
  });
  it('does not conflate the duplicate W-2 with a second wage source', () => {
    expect(graph.documentUsage('D10')).not.toContain('F1040.1a');
  });
  it('resolves prior-year pointers, FX parameters, page references, and messages', () => {
    expect(resolveReference('ref:fx.SEK.2025_average', graph)).toBe(9.86);
    expect(resolveReference('py:/return_2024/lines/F1040.1a', graph)).toBe(
      156039,
    );
    expect(resolveReference('doc:D08#page1', graph)).toHaveProperty(
      'printed_content',
    );
    expect(resolveReference('qa-14', graph)).toHaveProperty('answer');
    expect(resolveReference('missing-ref', graph)).toBeUndefined();
  });
  it('terminates even when inputs contain a cycle', () => {
    const copy = structuredClone(packet);
    copy.return_versions[2].lines[0].inputs = ['F1040.1z'];
    expect(createGraph(copy, 'v3').evidence('F1040.1a')).toContain('ev-0016');
  });
});

describe('independent review checks', () => {
  it('detects double-counted sweep income and wrong-year FX independently of engine diagnostics', () => {
    const findings = findIssues(graph);
    expect(findings.find((f) => f.id === 'duplicate-sweep')?.refs).toEqual([
      'ev-0492',
      'ev-0538',
    ]);
    expect(findings.find((f) => f.id === 'fx-year')?.origin).toBe(
      'Independent year check',
    );
  });
  it('detects a high-confidence W-2 mistake if one is introduced', () => {
    const copy = structuredClone(packet);
    copy.extracted_values.find((v) => v.id === 'ev-0016')!.value = 104800;
    expect(
      findIssues(createGraph(copy, 'v3')).find((f) => f.id === 'source-ev-0016')
        ?.expected,
    ).toBe(104600);
  });
  it('finds the supplied high-confidence zero bases by matching supplemental evidence', () => {
    const findings = findIssues(graph).filter((finding) =>
      finding.id.startsWith('missing-zero-'),
    );
    expect(findings.map((finding) => finding.id)).toEqual([
      'missing-zero-ev-0498',
      'missing-zero-ev-0516',
      'missing-zero-ev-0525',
    ]);
    expect(findings[0]).toMatchObject({
      refs: ['ev-0498', 'ev-0066', 'ev-0067'],
      expected: 19100,
      origin: 'Independent cross-document check',
      correction: {
        target: 'ev-0498',
        proposedValue: 19100,
        affectedLine: 'F8949.B.N1',
        originalTaxableAmount: 19240,
        proposedTaxableAmount: 140,
        taxableDelta: -19100,
        category: 'stcg',
      },
    });
  });
  it('does not treat a printed zero or a missing null as a blank zero mistake', () => {
    const copy = structuredClone(packet);
    copy.extracted_values.find(
      (value) => value.id === 'ev-0498',
    )!.text_as_read = '0.00';
    copy.extracted_values.find((value) => value.id === 'ev-0516')!.value = null;
    const ids = findIssues(createGraph(copy, 'v3')).map(
      (finding) => finding.id,
    );
    expect(ids).not.toContain('missing-zero-ev-0498');
    expect(ids).not.toContain('missing-zero-ev-0516');
  });
});

describe('review records and estimates', () => {
  it('allows a documented verification and rejects undocumented changes', () => {
    expect(() => validateEvent(event, reviewer, [])).not.toThrow();
    expect(() => validateEvent({ ...event, note: ' ' }, reviewer, [])).toThrow(
      'reason',
    );
  });
  it('prevents administrator writes and preparer resolution', () => {
    const admin = packet.firm.staff.find(
      (s) => s.role === 'firm_administrator',
    )!;
    expect(() => validateEvent(event, admin, [])).toThrow();
    const preparer = packet.firm.staff[0];
    expect(() =>
      validateEvent(
        { ...event, actor: preparer.id, role: preparer.role, kind: 'resolve' },
        preparer,
        [],
      ),
    ).toThrow('reviewer or partner');
  });
  it('undo retains the original event and permits only its author', () => {
    const undo: ReviewEvent = {
      ...event,
      id: 'undo',
      kind: 'undo',
      reverses: event.id,
    };
    expect(() => validateEvent(undo, reviewer, [event])).not.toThrow();
    expect(activeEvents([event, undo])).toHaveLength(0);
    const partner = packet.firm.staff.find((s) => s.role === 'partner')!;
    expect(() =>
      validateEvent(
        { ...undo, actor: partner.id, role: partner.role },
        partner,
        [event],
      ),
    ).toThrow('own');
  });
  it('estimates a delta from supplied category rates without mutating the return', () => {
    const before = graph.version.summary.federal.total_tax;
    const estimate = estimateImpact(graph.version, 'interest', -1840);
    expect(estimate.federal).toBeCloseTo(
      -1840 * graph.version.tax_effect_rates.interest.federal_per_dollar,
    );
    expect(graph.version.summary.federal.total_tax).toBe(before);
    expect(() => estimateImpact(graph.version, 'invented', 1)).toThrow();
  });
  it('requires reviewer approval before a supplied correction can resolve its issue', () => {
    const preparer = packet.firm.staff.find(
      (staff) => staff.role === 'preparer',
    )!;
    const proposal: ReviewEvent = {
      id: 'proposal',
      at: '2026-10-17T00:00:00Z',
      actor: preparer.id,
      role: preparer.role,
      version: 'v3',
      kind: 'adjust',
      target: 'ev-0498',
      findingId: 'missing-zero-ev-0498',
      original: 0,
      amount: 19100,
      category: 'stcg',
      taxableDelta: -19100,
      note: 'Matched D28 lot N1 to the D11 supplemental basis record.',
    };
    expect(() => validateEvent(proposal, preparer, [])).not.toThrow();
    expect(() =>
      validateEvent(
        {
          ...proposal,
          id: 'preparer-approval',
          kind: 'approve',
          target: proposal.id,
        },
        preparer,
        [proposal],
      ),
    ).toThrow('reviewer or partner');
    const resolution: ReviewEvent = {
      ...event,
      id: 'resolution',
      kind: 'resolve',
      target: 'missing-zero-ev-0498',
      note: 'Correction approved and supporting evidence reviewed.',
    };
    expect(() => validateEvent(resolution, reviewer, [proposal])).toThrow(
      'approved',
    );
    const approval: ReviewEvent = {
      ...event,
      id: 'approval',
      kind: 'approve',
      target: proposal.id,
      findingId: proposal.findingId,
      note: 'Agreed acquisition date and adjusted basis to D11.',
    };
    expect(() => validateEvent(approval, reviewer, [proposal])).not.toThrow();
    expect(proposalDecision([proposal, approval], proposal.id)).toEqual(
      approval,
    );
    expect(() =>
      validateEvent(resolution, reviewer, [proposal, approval]),
    ).not.toThrow();
    expect(() =>
      validateEvent(
        {
          ...event,
          id: 'undo-approval',
          kind: 'undo',
          target: approval.target,
          reverses: approval.id,
          note: 'Undo approval after resolution.',
        },
        reviewer,
        [proposal, approval, resolution],
      ),
    ).toThrow('Reopen the issue');
  });
});

// The new interaction model retains legacy verification records without requiring them.
describe('final review sign-off', () => {
  it('blocks warnings, flags and proposals without requiring per-value verification', () => {
    expect(() => validateSignoff(reviewer, [], 'v3', 0)).not.toThrow();
    expect(() => validateSignoff(reviewer, [], 'v3', 1)).toThrow('blocking');
    expect(() =>
      validateSignoff(reviewer, [{ ...event, kind: 'flag' }], 'v3', 0),
    ).toThrow('blocking');
    expect(() =>
      validateSignoff(
        reviewer,
        [{ ...event, kind: 'adjust', amount: 0, original: 1840 }],
        'v3',
        0,
      ),
    ).toThrow('blocking');
    expect(() => validateSignoff(packet.firm.staff[0], [], 'v3', 0)).toThrow(
      'reviewer or partner',
    );
  });
  it('invalidates after a later action, including undo, and isolates versions', () => {
    const signature: ReviewEvent = {
      ...event,
      id: 'sign',
      kind: 'signoff',
      target: 'return',
    };
    expect(signoffState([signature], 'v3', 0).valid).toBe(true);
    expect(
      signoffState([signature, { ...event, id: 'note', kind: 'note' }], 'v3', 0)
        .reopened,
    ).toBe(true);
    expect(
      signoffState(
        [signature, { ...event, id: 'note', kind: 'note', version: 'v2' }],
        'v3',
        0,
      ).valid,
    ).toBe(true);
    expect(
      signoffState(
        [signature, { ...event, id: 'undo', kind: 'undo', reverses: 'sign' }],
        'v3',
        0,
      ).valid,
    ).toBe(false);
  });
});

describe('selective calculation disclosure', () => {
  it('shows small direct-source amounts as plain rows and removes redundant carry layers', () => {
    const wages = calculationPresentation(graph, 'F1040.1z');
    expect(wages.chain.map((l) => l.key)).toEqual(['F1040.1z', 'F1040.1a']);
    expect(wages.detail?.sources).toEqual(['ev-0016', 'ev-0035']);
    expect(wages.expandable).toBe(false);
    expect(calculationPresentation(graph, 'SchB.1.2').expandable).toBe(false);
    expect(calculationPresentation(graph, 'F1040.9').expandable).toBe(true);
  });
  it('keeps substantive transformations even when their amounts happen to agree', () => {
    const copy = structuredClone(packet);
    copy.return_versions[2].lines.find((l) => l.key === 'F1040.1z')!.rule =
      'R-SE';
    expect(
      calculationPresentation(createGraph(copy, 'v3'), 'F1040.1z').chain,
    ).toHaveLength(1);
  });
  it('retains every skipped line and stops safely on cycles', () => {
    const copy = structuredClone(packet);
    const target = copy.return_versions[2].lines.find(
      (l) => l.key === 'F1040.1a',
    )!;
    target.rule = 'R-SUM';
    target.inputs = ['F1040.1z'];
    target.sources = [];
    expect(
      calculationPresentation(createGraph(copy, 'v3'), 'F1040.1z').chain,
    ).toHaveLength(2);
  });
});

describe('packet-only schedule mappings', () => {
  it('uses snapshot sources and excludes duplicate W-2 images', () => {
    expect(graph.evidence('F1040.1a')).toContain('ev-0016');
    expect(
      graph.evidence('F1040.1a').map((id) => graph.values.get(id)?.document_id),
    ).not.toContain('D10');
  });
  it('preserves missing cells and does not manufacture summary amounts', () => {
    const row = summaryRows.find((r) => r.label === 'California-source AGI')!;
    expect('federal' in row).toBe(false);
    for (const row of summaryRows)
      for (const name of ['federal', 'california'] as const) {
        const ref =
          name in row ? (row as Record<string, string>)[name] : undefined;
        if (ref) expect(graph.lines.has(ref)).toBe(true);
      }
  });
  it('does not propagate a calculation warning backward into its source rows', () => {
    expect(
      relevantFindings(graph, findIssues(graph), ['ev-0016']).some(
        (f) => f.id === 'CA_AMT_NOT_COMPUTED',
      ),
    ).toBe(false);
  });
  it('does not substitute original dividends for corrected data and links warnings using references', () => {
    expect(
      graph.lines.get('SchB.5.2')?.sources.find((id) => id === 'ev-0699'),
    ).toBe('ev-0699');
    expect(
      createGraph(packet, 'v1')
        .lines.get('SchB.5.2')
        ?.sources.find((id) => id === 'ev-0540'),
    ).toBe('ev-0540');
    expect(
      relevantFindings(graph, findIssues(graph), ['SchB.1.2']).some(
        (f) => f.id === 'duplicate-sweep',
      ),
    ).toBe(true);
    expect(
      relevantFindings(graph, findIssues(graph), ['ev-0016']).some(
        (f) => f.id === 'duplicate-sweep',
      ),
    ).toBe(false);
  });
});

describe('issue locations', () => {
  it('highlights the downstream chain without marking unrelated inputs', () => {
    const issues = findIssues(graph);
    expect(amountIssue(graph, issues, 'ev-0538')).toBeDefined();
    expect(amountIssue(graph, issues, 'SchB.1.2')?.kind).toBe('upstream');
    expect(amountIssue(graph, issues, 'F1040.11')?.kind).toBe('upstream');
    expect(amountIssue(graph, [], 'ev-0538')).toBeUndefined();
    expect(amountIssue(graph, issues, 'ev-0016')).toBeUndefined();
  });
});

describe('unified summary coverage', () => {
  it('preserves every line and finds a real dependency path for every linked issue', () => {
    const other = new Set(additionalRecords(graph).map((l) => l.key));
    for (const line of graph.lines.values())
      expect(
        other.has(line.key) ||
          summaryRoots.some((root) => referencePath(graph, root, line.key)),
      ).toBeTruthy();
    const location = summaryLocation(graph, 'ev-0538');
    expect(location.root).toBe('F1040.9');
    expect(location.path.at(-1)).toBe('ev-0538');
    for (let i = 1; i < location.path.length; i++) {
      const parent = graph.lines.get(location.path[i - 1])!;
      expect([...parent.inputs, ...parent.sources]).toContain(location.path[i]);
    }
    expect(summaryLocation(graph, 'qa-14')).toEqual({
      root: 'qa-14',
      path: ['qa-14'],
      additional: true,
    });
  });
});
