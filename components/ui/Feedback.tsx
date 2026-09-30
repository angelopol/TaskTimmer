import React from 'react';
import { IconAlert, IconClock } from './icons';
import { Button } from './Button';

export function LoadingState({ label = 'Loading your information…' }: { label?: string }) {
  return <div role="status" className="tt-panel tt-panel-padding space-y-4">
    <p className="tt-text-muted text-sm">{label}</p>
    <div aria-hidden="true" className="tt-skeleton h-5 w-1/3" />
    <div aria-hidden="true" className="tt-skeleton h-3 w-2/3" />
    <div aria-hidden="true" className="tt-skeleton h-3 w-1/2" />
  </div>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="tt-error flex flex-wrap items-center gap-3">
    <IconAlert className="shrink-0" size={20} /><p className="min-w-0 flex-1">{message}</p>
    {onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
  </div>;
}
export function EmptyState({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return <div className="tt-panel tt-empty">
    <span className="tt-empty-icon"><IconClock size={26} /></span>
    <h2 className="text-lg font-semibold">{title}</h2>
    <p className="tt-text-muted mx-auto mt-2 max-w-md text-sm">{description}</p>
    {children && <div className="mt-5 flex flex-wrap justify-center gap-3">{children}</div>}
  </div>;
}
