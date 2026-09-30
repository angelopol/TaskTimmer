"use client";
import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './Button';
import { IconClose } from './icons';

export function Dialog({ open, onClose, title, description, children, busy = false, wide = false }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode; busy?: boolean; wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [open, mounted]);
  if (!mounted) return null;
  return createPortal(
    <dialog ref={ref} className="tt-dialog" style={wide ? { width:'min(100% - 32px, 840px)' } : undefined}
      aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]')).filter(element => element.getClientRects().length > 0);
        const first = elements[0], last = elements[elements.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={event => {
        if (event.target !== event.currentTarget || busy) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}>
      <div className="tt-dialog-header">
        <div><h2 id={titleId} className="text-xl font-semibold tracking-tight">{title}</h2>
          {description && <p id={descriptionId} className="tt-text-muted mt-1 text-sm">{description}</p>}</div>
        <IconButton icon={<IconClose size={20} />} label="Close dialog" variant="ghost" onClick={onClose} disabled={busy} />
      </div>
      <div className="tt-dialog-body">{open && children}</div>
    </dialog>, document.body);
}
