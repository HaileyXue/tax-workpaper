import { useState } from 'react';
import {
  FileText,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { sourceAmount, type Graph, type SourceValue } from '../domain/packet';

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
  const pages = [...doc.pages].sort((a, b) => a.page - b.page);
  const [pageNumber, setPageNumber] = useState(
    value?.page ?? pages[0]?.page ?? 1,
  );
  const pageIndex = pages.findIndex((p) => p.page === pageNumber);
  const page = doc.pages.find((p) => p.page === pageNumber);
  const extracted = [...graph.values.values()].filter(
    (v) => v.document_id === documentId,
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
      <h3 className="source-document-title">
        <span className="document-id">{doc.id}</span>
        {doc.title}
      </h3>
      <p className="muted small">{doc.file_name}</p>
      <div className="document-toolbar">
        <button
          aria-label="Previous page"
          disabled={pageIndex <= 0}
          onClick={() => setPageNumber(pages[pageIndex - 1].page)}
        >
          <ChevronLeft size={16} />
        </button>
        <label>
          Page{' '}
          <select
            value={pageNumber}
            onChange={(e) => setPageNumber(Number(e.target.value))}
          >
            {pages.map((p) => (
              <option key={p.page} value={p.page}>
                {p.page}
              </option>
            ))}
          </select>{' '}
          of {doc.page_count}
        </label>
        <button
          aria-label="Next page"
          disabled={pageIndex < 0 || pageIndex >= pages.length - 1}
          onClick={() => setPageNumber(pages[pageIndex + 1].page)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      {value && (
        <div className="locator">
          <strong>{value.label}</strong>
          <span>Page {value.page}</span>
        </div>
      )}
      <article className="paper">
        <div className="paper-heading">
          <strong>{doc.document_type}</strong>
          <span>{doc.tax_year}</span>
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
        <div className="paper-footer">PAGE {pageNumber} · SIMULATED SOURCE</div>
      </article>
      {value && value.page === pageNumber && !unique && (
        <p className="callout">
          The extracted text cannot be uniquely located on this page. Compare
          the named field with the printed content; no exact text highlight is
          claimed.
        </p>
      )}
      <details className="utility-section">
        <summary>Extracted fields ({extracted.length})</summary>
        <p className="small muted">
          All extracted fields in this document. Select a field to open its
          page.
        </p>
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
                  Page {v.page} · {Math.round(v.confidence * 100)}% extraction
                  confidence
                </small>
              </span>
              <strong>{sourceAmount(v)}</strong>
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
              {graph.lines.get(key)?.label ?? 'Supporting calculation'}
              <ArrowUpRight size={12} />
            </button>
          ))}
        </div>
        {!graph.documentUsage(documentId).length && (
          <p className="muted">
            No linked calculations.{' '}
            {graph.version.documents_superseded.includes(documentId)
              ? 'Replaced by another document.'
              : graph.version.documents_used.includes(documentId)
                ? 'Listed as used; purpose needs review.'
                : 'Not listed as used in this version; disposition needs review.'}
          </p>
        )}
      </details>
    </section>
  );
}
