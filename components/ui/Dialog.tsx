"use client";
import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './Button';
import { IconClose } from './icons';

/** Modal dialog; rendered as a bottom sheet on phones (drag the header down to dismiss). */
export function Dialog({ open, onClose, title, description, children, busy = false, wide = false }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode; busy?: boolean; wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ y:number; dy:number } | null>(null);
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
      dialog.style.transform = '';
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [open, mounted]);
  if (!mounted) return null;
  const onTouchStart = (event:React.TouchEvent) => { if (!busy) drag.current = { y:event.touches[0].clientY, dy:0 }; };
  const onTouchMove = (event:React.TouchEvent) => {
    if (!drag.current || !ref.current) return;
    drag.current.dy = Math.max(0, event.touches[0].clientY - drag.current.y);
    ref.current.style.transition = 'none';
    ref.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onTouchEnd = () => {
    const dialog = ref.current, state = drag.current;
    drag.current = null;
    if (!dialog || !state) return;
    dialog.style.transition = 'transform .2s ease-out';
    if (state.dy > 90) onClose(); else dialog.style.transform = '';
  };
  return createPortal(
    <dialog ref={ref} className={'tt-dialog' + (wide ? ' tt-dialog-wide' : '')}
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
      <div className="tt-dialog-header" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
        <span className="tt-sheet-handle" aria-hidden="true" />
        <div className="min-w-0"><h2 id={titleId} className="truncate text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p id={descriptionId} className="tt-text-muted text-sm">{description}</p>}</div>
        <IconButton icon={<IconClose size={20} />} label="Close" variant="ghost" className="!min-h-10 !w-10 rounded-full" onClick={onClose} disabled={busy} />
      </div>
      <div className="tt-dialog-body">{open && children}</div>
    </dialog>, document.body);
}
