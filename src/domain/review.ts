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
    | 'signoff';
  target: string;
  note: string;
  method?: string;
  amount?: number;
  original?: number;
  category?: string;
  reverses?: string;
}
export const STORAGE_KEY = 'miraflores.review.v1';
export function activeEvents(events: ReviewEvent[]) {
  const undone = new Set(
    events.filter((e) => e.kind === 'undo').map((e) => e.reverses),
  );
  return events.filter((e) => e.kind !== 'undo' && !undone.has(e.id));
}
export function canWrite(staff: Staff) {
  return ['preparer', 'reviewer', 'partner'].includes(staff.role);
}
export function validateEvent(
  event: ReviewEvent,
  staff: Staff,
  events: ReviewEvent[],
) {
  if (!canWrite(staff) || event.actor !== staff.id || event.role !== staff.role)
    throw new Error('This role cannot change review records.');
  if (!event.note.trim())
    throw new Error('A reason or evidence note is required.');
  if (
    event.kind === 'adjust' &&
    (!Number.isFinite(event.amount) || !Number.isFinite(event.original))
  )
    throw new Error('Enter a valid numeric adjustment.');
  if (event.kind === 'verify' && !event.method)
    throw new Error('Select a verification method.');
  if (event.kind === 'undo') {
    const original = activeEvents(events).find((e) => e.id === event.reverses);
    if (
      !original ||
      original.actor !== staff.id ||
      original.version !== event.version
    )
      throw new Error(
        'Only your own active actions in this version can be undone.',
      );
  }
  if (event.kind === 'signoff' && !['reviewer', 'partner'].includes(staff.role))
    throw new Error('Only a reviewer or partner can sign off the return.');
  if (event.kind === 'resolve' && staff.role === 'preparer')
    throw new Error('A reviewer or partner must resolve findings.');
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
    (e) =>
      e.kind === 'flag' &&
      active
        .filter(
          (a) => a.target === e.id && ['resolve', 'reopen'].includes(a.kind),
        )
        .at(-1)?.kind !== 'resolve',
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
