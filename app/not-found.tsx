"use client";
import Link from 'next/link';
import { buttonStyles } from '../components/ui/Button';
export default function NotFound() {
  return <section className="tt-panel tt-empty"><p className="tt-eyebrow mb-3">Page not found</p><h1 className="tt-heading-page">Let’s get you back on track</h1><p className="tt-text-muted mt-4">This page may have moved, or the link may be incorrect.</p><Link href="/" className={buttonStyles() + ' mt-6'}>Go to overview</Link></section>;
}
