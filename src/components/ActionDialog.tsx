import { useEffect, useRef, type ReactNode } from 'react';
export default function ActionDialog({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="action-dialog"
      aria-label="Record an exception"
      onCancel={onClose}
    >
      {children}
    </dialog>
  );
}
