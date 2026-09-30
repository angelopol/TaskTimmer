import React from 'react';
import { IconAlert, IconClock } from './icons';
import { Button } from './Button';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <div role="status" aria-label={label} className="tt-panel tt-panel-padding space-y-3">
    <div aria-hidden="true" className="tt-skeleton h-4 w-1/3" />
    <div aria-hidden="true" className="tt-skeleton h-3 w-2/3" />
    <div aria-hidden="true" className="tt-skeleton h-3 w-1/2" />
  </div>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="tt-error flex items-center gap-3">
    <IconAlert className="shrink-0" size={18} /><p className="min-w-0 flex-1">{message}</p>
    {onRetry && <Button variant="secondary" className="!min-h-9 shrink-0" onClick={onRetry}>Retry</Button>}
  </div>;
}
export function EmptyState({ title, description, icon, children }: { title: string; description?: string; icon?: React.ReactNode; children?: React.ReactNode }) {
  return <div className="tt-panel tt-empty">
    <span className="tt-empty-icon">{icon || <IconClock size={24} />}</span>
    <h2 className="font-semibold">{title}</h2>
    {description && <p className="tt-text-muted mx-auto mt-1 max-w-sm text-sm">{description}</p>}
    {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
  </div>;
}
