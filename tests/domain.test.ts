import {
  amountIssue,
  scheduleDestination,
  wagesAndInterest,
  dividends,
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
  it('uses the selected snapshot links and excludes duplicate W-2 images', () => {
    const rows = wagesAndInterest(graph);
    expect(rows.find((r) => r.id === 'D08')?.cells).toEqual({
      wages: 'ev-0016',
      withholding: 'ev-0017',
      stateWithholding: 'ev-0031',
    });
    expect(rows.some((r) => r.id === 'D10')).toBe(false);
    for (const version of packet.return_versions) {
      const g = createGraph(packet, version.version);
      for (const row of [...wagesAndInterest(g), ...dividends(g)]) {
        for (const ref of Object.values(row.cells))
          if (ref) expect(g.lines.has(ref) || g.values.has(ref)).toBe(true);
      }
    }
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
      dividends(graph).find((r) => r.id === 'SchB.5.2')?.cells.qualified,
    ).toBe('ev-0699');
    expect(
      dividends(createGraph(packet, 'v1')).find((r) => r.id === 'SchB.5.2')
        ?.cells.qualified,
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
  it('highlights only explicit issue references, never consumers or inferred inputs', () => {
    const issues = findIssues(graph);
    expect(amountIssue(graph, issues, 'ev-0538')).toBeDefined();
    expect(amountIssue(graph, issues, 'SchB.1.2')).toBeUndefined();
    expect(amountIssue(graph, issues, 'F1040.11')).toBeUndefined();
    expect(amountIssue(graph, [], 'ev-0538')).toBeUndefined();
    expect(amountIssue(graph, issues, 'ev-0016')).toBeUndefined();
  });
  it('locates a payer schedule only from direct supplied references', () => {
    expect(scheduleDestination(graph, ['ev-0538'])).toEqual({
      view: 'Wages & interest',
      ref: 'SchB.1.2',
    });
    expect(scheduleDestination(graph, ['qa-14'])).toBeUndefined();
  });
});
