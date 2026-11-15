import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { ReactNode } from "react";

/** Native <dialog>: focus is trapped, Escape closes, focus returns to the opener. */
export function Dialog({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    if (d && !d.open) d.showModal();
    return () => {
      d?.close();
      opener?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "dialog wide" : "dialog"}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close dialog">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
