"use client";
import React, { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, IconButton } from './Button';
import { IconCheck, IconMore } from './icons';

export interface MenuItem {
  label:string; icon?:React.ReactNode; onSelect?:()=>void; href?:string;
  danger?:boolean; checked?:boolean; disabled?:boolean;
}
export type MenuEntry = MenuItem | 'separator' | { heading:string } | false | null | undefined;

/** Dropdown menu anchored to a trigger. Closes on outside tap, Escape, or selection. */
export function Menu({ items, label = 'More options', trigger, triggerClassName = '', align = 'right', header }: {
  items:MenuEntry[]; label?:string; trigger?:React.ReactNode; triggerClassName?:string; align?:'left' | 'right'; header?:React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event:PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[role=menuitem]:not(:disabled), [role=menuitemcheckbox]:not(:disabled)')?.focus());
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  function close(focusTrigger = true) { setOpen(false); if (focusTrigger) button.current?.focus(); }
  function onKeyDown(event:React.KeyboardEvent) {
    if (event.key === 'Escape') { event.stopPropagation(); close(); return; }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const nodes = Array.from(root.current?.querySelectorAll<HTMLElement>('[role^=menuitem]:not(:disabled)') || []);
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    nodes[(index + (event.key === 'ArrowDown' ? 1 : -1) + nodes.length) % nodes.length]?.focus();
  }
  const entries = items.filter(Boolean) as Exclude<MenuEntry, false | null | undefined>[];
  const triggerProps = { 'aria-haspopup':'menu' as const, 'aria-expanded':open, 'aria-controls':open ? menuId : undefined, onClick:() => {
    // Open upwards when the trigger sits near the bottom (e.g. above the tab bar).
    if (!open && button.current) setUp(window.innerHeight - button.current.getBoundingClientRect().bottom < 300);
    setOpen(value => !value);
  } };
  return <div ref={root} className="relative shrink-0" onKeyDown={onKeyDown}>
    {trigger
      ? <Button ref={button} variant="ghost" className={triggerClassName} aria-label={label} {...triggerProps}>{trigger}</Button>
      : <IconButton ref={button} variant="ghost" icon={<IconMore size={20} />} label={label} className={triggerClassName} {...triggerProps} />}
    {open && <div id={menuId} role="menu" aria-label={label} className={'tt-menu ' + (up ? 'bottom-full mb-1.5 ' : 'top-full mt-1.5 ') + (align === 'right' ? 'right-0' : 'left-0') + (up ? (align === 'right' ? ' origin-bottom-right' : ' origin-bottom-left') : align === 'right' ? '' : ' origin-top-left')}>
      {header}
      {entries.map((entry, index) => {
        if (entry === 'separator') return <div key={index} role="separator" className="tt-menu-sep" />;
        if ('heading' in entry) return <p key={index} className="tt-menu-label">{entry.heading}</p>;
        const content = <>
          {entry.icon !== undefined && <span aria-hidden="true" className="flex w-5 shrink-0 justify-center opacity-80">{entry.icon}</span>}
          <span className="min-w-0 flex-1 truncate">{entry.label}</span>
          {entry.checked && <IconCheck size={18} className="shrink-0 text-indigo-600 dark:text-indigo-300" />}
        </>;
        const role = entry.checked === undefined ? 'menuitem' : 'menuitemcheckbox';
        if (entry.href) return <Link key={index} href={entry.href} role={role} className="tt-menu-item" data-danger={entry.danger || undefined} onClick={() => close(false)}>{content}</Link>;
        return <button key={index} type="button" role={role} aria-checked={entry.checked === undefined ? undefined : entry.checked} disabled={entry.disabled} className="tt-menu-item" data-danger={entry.danger || undefined}
          onClick={() => { close(); entry.onSelect?.(); }}>{content}</button>;
      })}
    </div>}
  </div>;
}

export interface Action extends MenuItem { primary?:boolean }
/** Inline buttons on larger screens; on phones only primary actions stay visible and the rest fold into a menu. */
export function ActionBar({ actions, className = '' }: { actions:(Action | false | null | undefined)[]; className?:string }) {
  const list = actions.filter(Boolean) as Action[];
  const secondary = list.filter(action => !action.primary);
  const render = (action:Action, extra = '') => {
    const style = action.primary ? 'primary' : 'secondary';
    if (action.href) return <Link key={action.label} href={action.href} className={'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ' + (action.primary ? 'bg-indigo-600 text-white hover:bg-indigo-700 ' : 'border border-[var(--line-strong)] bg-[var(--surface)] hover:bg-[var(--surface-2)] ') + extra}>{action.icon}{action.label}</Link>;
    return <Button key={action.label} variant={style} leftIcon={action.icon} disabled={action.disabled} onClick={action.onSelect} className={extra}>{action.label}</Button>;
  };
  return <div className={'flex items-center gap-2 ' + className}>
    {list.map(action => render(action, action.primary ? '' : 'hidden sm:inline-flex'))}
    {secondary.length > 0 && <div className="sm:hidden"><Menu items={secondary} /></div>}
  </div>;
}
