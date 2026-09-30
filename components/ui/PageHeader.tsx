import React from 'react';

/**
 * Page title + actions. On phones the title lives in the app bar, so it is visually hidden there;
 * pass `mobile={false}` when the actions have a phone alternative (e.g. a FAB) to drop the row entirely.
 */
export function PageHeader({ title, children, mobile = true }: { title:string; children?:React.ReactNode; mobile?:boolean }) {
  return <header className={'tt-page-header min-h-11 ' + (children && mobile ? '' : 'max-sm:hidden')}>
    <h1 className="tt-heading-page max-sm:sr-only">{title}</h1>
    {children && <div className="flex min-w-0 items-center gap-2 max-sm:flex-1 max-sm:justify-end">{children}</div>}
  </header>;
}
