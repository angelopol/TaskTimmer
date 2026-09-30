"use client";
import { Button, buttonStyles } from '../components/ui/Button';
import Link from 'next/link';
export default function ErrorPage({ reset }: { error:Error; reset:()=>void }) {
  return <section className="tt-panel tt-empty" role="alert"><h1 className="tt-heading-page">We could not load this page</h1><p className="tt-text-muted mx-auto mt-4 max-w-md">Please try again. If the problem continues, return to your overview and try another page.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Button onClick={reset}>Try again</Button><Link href="/" className={buttonStyles('secondary')}>Back to overview</Link></div></section>;
}
