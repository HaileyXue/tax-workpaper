import { useEffect, useState } from 'react';

export default function EvidenceResizeHandle({
  width,
  onChange,
}: {
  width: number;
  onChange: (width: number) => void;
}) {
  const maximum = () =>
    Math.max(
      300,
      window.innerWidth - (window.innerWidth <= 1100 ? 180 : 210) - 360,
    );
  const [max, setMax] = useState(maximum);
  useEffect(() => {
    const resize = () => setMax(maximum());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const current = Math.min(max, Math.max(300, width));
  const update = (next: number) => onChange(Math.min(max, Math.max(300, next)));
  return (
    <div
      className="evidence-resize-handle"
      role="separator"
      tabIndex={0}
      aria-label="Resize source evidence"
      aria-orientation="vertical"
      aria-controls="source-evidence"
      aria-valuemin={300}
      aria-valuemax={max}
      aria-valuenow={current}
      aria-valuetext={`${current} pixels wide`}
      title="Drag to resize. Left arrow widens; right arrow narrows."
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.focus();
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          update(window.innerWidth - e.clientX);
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onKeyDown={(e) => {
        const next =
          e.key === 'ArrowLeft'
            ? current + 24
            : e.key === 'ArrowRight'
              ? current - 24
              : e.key === 'Home'
                ? 300
                : e.key === 'End'
                  ? max
                  : undefined;
        if (next !== undefined) {
          e.preventDefault();
          update(next);
        }
      }}
    />
  );
}
