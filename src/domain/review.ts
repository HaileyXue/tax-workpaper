import type { ReturnVersion, Staff } from './packet';
export interface ReviewEvent {
  id: string;
  at: string;
  actor: string;
  role: string;
  version: string;
  kind:
    | 'verify'
    | 'flag'
    | 'adjust'
    | 'resolve'
    | 'reopen'
    | 'assign'
    | 'undo'
    | 'note'
    | 'signoff'
    | 'approve'
    | 'return'
    | 'reject';
  target: string;
  note: string;
  method?: string;
  amount?: number;
  original?: number;
  category?: string;
  reverses?: string;
  findingId?: string;
  evidenceRefs?: string[];
  affectedLine?: string;
  originalTaxableAmount?: number;
  proposedTaxableAmount?: number;
  taxableDelta?: number;
}
export const STORAGE_KEY = 'tax-workpaper.review.v3';
const OBSOLETE_STORAGE_KEYS = ['miraflores.review.v1', 'miraflores.review.v2'];
export function activeEvents(events: ReviewEvent[]) {
  const undone = new Set(
    events.filter((e) => e.kind === 'undo').map((e) => e.reverses),
  );
  return events.filter((e) => e.kind !== 'undo' && !undone.has(e.id));
}
export function canWrite(staff: Staff) {
  return ['preparer', 'reviewer', 'partner'].includes(staff.role);
}
export function canAssign(staff: Staff) {
  return ['reviewer', 'partner'].includes(staff.role);
}
export function validateEvent(
  event: ReviewEvent,
  staff: Staff,
  events: ReviewEvent[],
) {
  if (!canWrite(staff) || event.actor !== staff.id || event.role !== staff.role)
    throw new Error('This role cannot change review records.');
  if (event.kind === 'assign' && !canAssign(staff))
    throw new Error('Only a reviewer or partner can assign issues.');
  if (!event.note.trim())
    throw new Error('A reason or evidence note is required.');
  if (
    event.kind === 'adjust' &&
    (event.amount !== undefined || event.original !== undefined) &&
    (!Number.isFinite(event.amount) || !Number.isFinite(event.original))
  )
    throw new Error('Enter a valid numeric adjustment.');
  if (event.kind === 'verify' && !event.method)
    throw new Error('Select a verification method.');
  if (event.kind === 'undo') {
    const active = activeEvents(events);
    const original = active.find((e) => e.id === event.reverses);
    if (
      !original ||
      original.actor !== staff.id ||
      original.version !== event.version
    )
      throw new Error(
        'Only your own active actions in this version can be undone.',
      );
    const resolvedFinding =
      original.findingId &&
      active
        .filter(
          (candidate) =>
            candidate.target === original.findingId &&
            ['resolve', 'reopen'].includes(candidate.kind),
        )
        .at(-1)?.kind === 'resolve';
    if (resolvedFinding && ['adjust', 'approve'].includes(original.kind))
      throw new Error(
        'Reopen the issue before undoing its correction or approval.',
      );
    if (
      original.kind === 'adjust' &&
      active.some(
        (candidate) =>
          candidate.target === original.id &&
          ['approve', 'return', 'reject'].includes(candidate.kind),
      )
    )
      throw new Error(
        'Undo the correction review decision before undoing its proposal.',
      );
  }
  if (event.kind === 'signoff' && !['reviewer', 'partner'].includes(staff.role))
    throw new Error('Only a reviewer or partner can sign off the return.');
  if (event.kind === 'resolve' && staff.role === 'preparer')
    throw new Error('A reviewer or partner must resolve findings.');
  if (event.kind === 'resolve') {
    const proposals = activeEvents(events).filter(
      (candidate) =>
        candidate.kind === 'adjust' && candidate.findingId === event.target,
    );
    const latest = proposals.at(-1);
    if (!latest)
      throw new Error('Document a correction before resolving this issue.');
    if (latest && proposalDecision(events, latest.id)?.kind !== 'approve')
      throw new Error(
        'The correction must be approved before this issue can be resolved.',
      );
  }
  if (
    ['approve', 'return', 'reject'].includes(event.kind) &&
    !['reviewer', 'partner'].includes(staff.role)
  )
    throw new Error('Only a reviewer or partner can review corrections.');
  if (['approve', 'return', 'reject'].includes(event.kind)) {
    const proposal = activeEvents(events).find(
      (candidate) =>
        candidate.id === event.target &&
        candidate.kind === 'adjust' &&
        candidate.version === event.version,
    );
    if (!proposal) throw new Error('The correction proposal is not active.');
    const decided = activeEvents(events)
      .filter(
        (candidate) =>
          candidate.target === proposal.id &&
          ['approve', 'return', 'reject'].includes(candidate.kind),
      )
      .at(-1);
    if (decided?.kind === event.kind)
      throw new Error('This correction already has that review decision.');
  }
}

export function proposalDecision(
  events: ReviewEvent[],
  proposalId: string,
): ReviewEvent | undefined {
  return activeEvents(events)
    .filter(
      (event) =>
        event.target === proposalId &&
        ['approve', 'return', 'reject'].includes(event.kind),
    )
    .at(-1);
}

export function findingIdForEvent(
  events: ReviewEvent[],
  event: ReviewEvent,
): string | undefined {
  if (event.findingId) return event.findingId;
  if (['assign', 'resolve', 'reopen'].includes(event.kind)) return event.target;
  if (['approve', 'return', 'reject'].includes(event.kind))
    return events.find((candidate) => candidate.id === event.target)?.findingId;
  return event.kind === 'flag' ? event.id : undefined;
}

/** An approved correction is the terminal issue decision in this prototype.
 * Explicit resolve/reopen events remain readable for older saved histories. */
export function findingResolved(events: ReviewEvent[], findingId: string) {
  const active = activeEvents(events);
  const explicit = active
    .filter(
      (event) =>
        event.target === findingId &&
        ['resolve', 'reopen'].includes(event.kind),
    )
    .at(-1);
  if (explicit) return explicit.kind === 'resolve';
  const proposal = active
    .filter((event) => event.kind === 'adjust' && event.findingId === findingId)
    .at(-1);
  return Boolean(
    proposal && proposalDecision(active, proposal.id)?.kind === 'approve',
  );
}
export function estimateImpact(
  version: ReturnVersion,
  category: string,
  delta: number,
) {
  const rate = version.tax_effect_rates[category];
  if (!rate)
    throw new Error('Select an applicable supplied tax-effect category.');
  return {
    federal: delta * rate.federal_per_dollar,
    california: delta * rate.california_per_dollar,
  };
}
export function loadReviews(): { events: ReviewEvent[]; error?: string } {
  try {
    OBSOLETE_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    const data: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (
      !Array.isArray(data) ||
      data.some(
        (e) =>
          !e ||
          typeof e.id !== 'string' ||
          typeof e.kind !== 'string' ||
          typeof e.version !== 'string' ||
          typeof e.note !== 'string',
      )
    )
      throw new Error();
    return { events: data as ReviewEvent[] };
  } catch {
    return {
      events: [],
      error:
        'Saved review data could not be read. It has not been overwritten. Export or clear the stored data before continuing.',
    };
  }
}

// Sign-off certifies this local review snapshot, not filing or engine recalculation.
export function signoffState(
  events: ReviewEvent[],
  version: string,
  openWarnings: number,
) {
  const relevant = events.filter((e) => e.version === version);
  const active = activeEvents(relevant);
  const latest = active.filter((e) => e.kind === 'signoff').at(-1);
  const signatureIndex = latest
    ? relevant.findIndex((e) => e.id === latest.id)
    : -1;
  const changed =
    latest &&
    relevant.slice(signatureIndex + 1).some((e) => e.kind !== 'signoff');
  const flags = active.filter(
    (event) => event.kind === 'flag' && !findingResolved(active, event.id),
  ).length;
  const proposals = active.filter((e) => e.kind === 'adjust').length;
  const blockers = openWarnings + flags + proposals;
  return {
    latest,
    valid: Boolean(latest && !changed && !blockers),
    reopened: Boolean(latest && (changed || blockers)),
    blockers,
    flags,
    proposals,
  };
}
export function validateSignoff(
  staff: Staff,
  events: ReviewEvent[],
  version: string,
  openWarnings: number,
) {
  if (!['reviewer', 'partner'].includes(staff.role))
    throw new Error('Only a reviewer or partner can sign off the return.');
  const state = signoffState(events, version, openWarnings);
  if (state.blockers)
    throw new Error(
      'Resolve blocking issues and withdraw or reconcile correction proposals before signing off.',
    );
  if (state.valid)
    throw new Error('This review snapshot is already signed off.');
}
