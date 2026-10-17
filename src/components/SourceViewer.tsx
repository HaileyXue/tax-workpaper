import { useState } from 'react';
import { FileText, ArrowUpRight } from 'lucide-react';
import { money, type Graph, type SourceValue } from '../domain/packet';

export default function SourceViewer({
  graph,
  documentId,
  value,
  onReference,
}: {
  graph: Graph;
  documentId: string;
  value?: SourceValue;
  onReference: (id: string) => void;
}) {
  const doc = graph.documents.get(documentId)!;
  const [pageNumber, setPageNumber] = useState(value?.page ?? 1);
  const page = doc.pages.find((p) => p.page === pageNumber);
  const extracted = [...graph.values.values()].filter(
    (v) => v.document_id === documentId && v.page === pageNumber,
  );
  const text = page?.printed_content ?? 'No page text supplied.';
  // Synthetic bounding boxes are not real PDF coordinates. Highlight only an exact
  // text occurrence; keep the field/page locator explicit when text does not match.
  const needle = value?.page === pageNumber ? value.text_as_read : '';
  const index = needle ? text.indexOf(needle) : -1;
  const unique =
    index >= 0 && text.indexOf(needle, index + needle.length) === -1;
  return (
    <section className="source-view">
      <div className="section-top">
        <span className="eyebrow">
          <FileText size={14} /> SOURCE DOCUMENT
        </span>
        <span className="tag">Simulated document</span>
      </div>
      <h3>{doc.title}</h3>
      <p className="muted small">
        {doc.id} · {doc.file_name}
      </p>
      <div className="document-toolbar">
        <label>
          Page{' '}
          <select
            value={pageNumber}
            onChange={(e) => setPageNumber(Number(e.target.value))}
          >
            {doc.pages.map((p) => (
              <option key={p.page} value={p.page}>
                {p.page}
              </option>
            ))}
          </select>{' '}
          of {doc.page_count}
        </label>
        <span>Printed content from packet</span>
      </div>
      {value && (
        <div className="locator">
          <strong>{value.label}</strong>
          <span>
            Page {value.page} · Field {value.field} · {value.id}
          </span>
        </div>
      )}
      <article className="paper">
        <div className="paper-heading">
          <strong>{doc.document_type}</strong>
          <span>2025</span>
        </div>
        <div className="printed-text">
          {unique ? (
            <>
              {text.slice(0, index)}
              <mark>{needle}</mark>
              {text.slice(index + needle.length)}
            </>
          ) : (
            text
          )}
        </div>
        <div className="paper-footer">
          {doc.id} / PAGE {pageNumber} · SIMULATED SOURCE
        </div>
      </article>
      {value && !unique && (
        <p className="callout">
          The extracted text cannot be uniquely located on this page. Compare
          the named field with the printed content; no exact text highlight is
          claimed.
        </p>
      )}
      <details className="utility-section">
        <summary>Other extracted fields on this page</summary>
        <h4>
          Extracted fields on this page{' '}
          <span className="muted">{extracted.length}</span>
        </h4>
        <div className="field-list">
          {extracted.map((v) => (
            <button
              className={`field-row ${v.id === value?.id ? 'selected' : ''}`}
              key={v.id}
              onClick={() => onReference(v.id)}
            >
              <span>
                {v.label}
                <small>
                  {v.id} · {Math.round(v.confidence * 100)}% confidence
                </small>
              </span>
              <strong>
                {v.value_type === 'money'
                  ? money(v.value)
                  : String(v.value ?? '—')}
              </strong>
            </button>
          ))}
        </div>
      </details>
      <details className="utility-section">
        <summary>
          Where this document lands ({graph.documentUsage(documentId).length}{' '}
          lines)
        </summary>
        <div className="chips">
          {graph.documentUsage(documentId).map((key) => (
            <button key={key} onClick={() => onReference(key)}>
              {key}
              <ArrowUpRight size={12} />
            </button>
          ))}
        </div>
        {!graph.documentUsage(documentId).length && (
          <p className="muted">
            No mapped tax-line consumers.{' '}
            {graph.version.documents_superseded.includes(documentId)
              ? 'Marked superseded by the engine.'
              : graph.version.documents_used.includes(documentId)
                ? 'Listed as used by the engine; purpose needs review.'
                : 'Not listed as used in this version; disposition needs review.'}
          </p>
        )}
      </details>
    </section>
  );
}
