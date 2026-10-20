import rawPacket from '../../okafor_lindqvist_2025_packet.json';

export type Scalar = string | number | boolean | null;
export interface SourceValue {
  id: string;
  document_id: string;
  page: number;
  field: string;
  label: string;
  value: Scalar;
  value_type: string;
  text_as_read: string;
  confidence: number;
  position: { x0: number; y0: number; x1: number; y1: number };
}
export interface SourceDocument {
  tax_year: number;
  id: string;
  title: string;
  issuer: string;
  belongs_to: string;
  uploaded_by: string;
  document_type: string;
  file_name: string;
  received_at: string;
  marked_corrected?: boolean;
  page_count: number;
  pages: { page: number; printed_content: string }[];
  extraction: { status: string; reason: string | null };
}
export interface TaxLine {
  key: string;
  jurisdiction: string;
  form: string;
  line: string;
  label: string;
  value: Scalar;
  rule: string;
  inputs: string[];
  sources: string[];
  note?: string;
}
export interface Diagnostic {
  code: string;
  severity: string;
  message: string;
  refs: string[];
}
export interface ReturnVersion {
  version: string;
  computed_at: string;
  trigger: string;
  lines: TaxLine[];
  documents_used: string[];
  documents_superseded: string[];
  diagnostics: Diagnostic[];
  changes_from_previous: Record<string, unknown>[];
  summary: Record<string, Record<string, number>>;
  tax_effect_rates: Record<
    string,
    { federal_per_dollar: number; california_per_dollar: number }
  >;
  assets: ({ asset_id: string } & Record<string, unknown>)[];
}
export interface Staff {
  id: string;
  name: string;
  role: string;
  sensitive_data_clearance: boolean;
}
export interface Packet {
  packet: { name: string; version: string; client_id: string };
  documents: SourceDocument[];
  extracted_values: SourceValue[];
  return_versions: ReturnVersion[];
  engine_reference: {
    parameters: Record<string, unknown>;
    rules: Record<string, string>;
  };
  prior_years: {
    return_2024: { lines: Record<string, Scalar> };
    [key: string]: unknown;
  };
  tax_agency_records: Record<string, unknown>;
  client: Record<string, ({ id: string } & Record<string, unknown>)[]>;
  household: { people: ({ id: string } & Record<string, unknown>)[] };
  firm: {
    staff: Staff[];
    starter_standards: {
      verification_types: string[];
      required_steps: string[];
    };
  };
  timeline: {
    id: string;
    at: string;
    event: string;
    detail: unknown;
    refs: string[];
  }[];
  what_if: {
    alternatives: {
      id: string;
      description: string;
      base_version: string;
      federal: { total_tax_change: number };
      california: { total_tax_change: number };
    }[];
  };
}
// The supplied fixture is imported without rewriting or normalizing it on disk.
export const packet = rawPacket as unknown as Packet;
export const money = (value: Scalar | undefined) =>
  typeof value === 'number'
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
      }).format(value)
    : String(value ?? '—');

export function createGraph(data: Packet, versionId: string) {
  const version = data.return_versions.find((v) => v.version === versionId);
  if (!version) throw new Error(`Unknown return version: ${versionId}`);
  const lines = new Map(version.lines.map((x) => [x.key, x]));
  const values = new Map(data.extracted_values.map((x) => [x.id, x]));
  const documents = new Map(data.documents.map((x) => [x.id, x]));
  const consumers = new Map<string, Set<string>>();
  for (const line of version.lines)
    for (const ref of [...line.inputs, ...line.sources]) {
      if (!consumers.has(ref)) consumers.set(ref, new Set());
      consumers.get(ref)!.add(line.key);
    }
  function downstream(ref: string): string[] {
    const found = new Set<string>();
    const visit = (id: string) => {
      for (const key of consumers.get(id) ?? [])
        if (!found.has(key)) {
          found.add(key);
          visit(key);
        }
    };
    visit(ref);
    return [...found];
  }
  function evidence(key: string): string[] {
    const found = new Set<string>(),
      visited = new Set<string>();
    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      const line = lines.get(id);
      if (line) [...line.inputs, ...line.sources].forEach(visit);
      else found.add(id);
    };
    visit(key);
    return [...found];
  }
  function documentUsage(id: string) {
    const refs = data.extracted_values
      .filter((v) => v.document_id === id)
      .flatMap((v) => downstream(v.id));
    for (const ref of consumers.keys())
      if (ref === id || ref.startsWith(`doc:${id}#`))
        refs.push(...downstream(ref));
    return [...new Set(refs)];
  }
  return {
    version,
    lines,
    values,
    documents,
    consumers,
    downstream,
    evidence,
    documentUsage,
  };
}
export type Graph = ReturnType<typeof createGraph>;

function pointer(root: unknown, path: string): unknown {
  return path
    .split('/')
    .slice(1)
    .reduce<unknown>((node, key) => {
      const decoded = key.replace(/~1/g, '/').replace(/~0/g, '~');
      return node && typeof node === 'object'
        ? (node as Record<string, unknown>)[decoded]
        : undefined;
    }, root);
}
export function resolveReference(ref: string, graph: Graph): unknown {
  if (graph.values.has(ref)) return graph.values.get(ref);
  if (graph.documents.has(ref)) return graph.documents.get(ref);
  if (graph.lines.has(ref)) return graph.lines.get(ref);
  if (ref.startsWith('py:')) return pointer(packet.prior_years, ref.slice(3));
  if (ref.startsWith('agency:'))
    return pointer(packet.tax_agency_records, ref.slice(7));
  if (ref.startsWith('ref:param.'))
    return packet.engine_reference.parameters[ref.slice(10)];
  if (ref.startsWith('ref:fx.SEK.'))
    return pointer(
      packet.engine_reference.parameters,
      `/fx/SEK/${ref.slice(11)}`,
    );
  if (ref.startsWith('asset:'))
    return (
      graph.version.assets.find((a) => a.asset_id === ref.slice(6)) ??
      (packet.prior_years.asset_records as { asset_id: string }[]).find(
        (a) => a.asset_id === ref.slice(6),
      )
    );
  if (ref.startsWith('household:'))
    return packet.household.people.find((p) => p.id === ref.slice(10));
  if (ref.startsWith('timeline:'))
    return packet.timeline.find((t) => t.id === ref.slice(9));
  const page = /^doc:(D\d+)#page(\d+)$/.exec(ref);
  if (page)
    return graph.documents
      .get(page[1])
      ?.pages.find((p) => p.page === Number(page[2]));
  return Object.values(packet.client)
    .flat()
    .find((item) => item.id === ref);
}

// Preserve explicitly supplied foreign-currency units in extracted fields.
export function sourceAmount(value: SourceValue): string {
  if (
    value.value_type === 'money' &&
    typeof value.value === 'number' &&
    /sek/i.test(value.field)
  ) {
    return `${value.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SEK`;
  }
  return value.value_type === 'money'
    ? money(value.value)
    : String(value.value ?? '—');
}

export function documentOwnerLabel(owner: string): string {
  if (owner === 'joint') return 'Joint';
  const person = packet.household.people.find((p) =>
    owner.startsWith('dependent:')
      ? p.id === owner.slice(10)
      : p.role === owner,
  );
  return person && typeof person.name === 'string' ? person.name : owner;
}
export function documentUploaderLabel(uploader: string): string {
  return uploader === 'client'
    ? 'Client'
    : uploader === 'firm'
      ? 'Firm'
      : uploader;
}
