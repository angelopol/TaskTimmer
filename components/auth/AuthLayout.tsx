"use client";
import React from 'react';
import Link from 'next/link';
import { IconClock, IconCalendar, IconLog } from '../ui/icons';
import { useTheme } from '../ThemeProvider';
import { Button } from '../ui/Button';
export function AuthLayout({ children, title, subtitle }: { children:React.ReactNode; title:string; subtitle?:string }) {
  const { theme, toggle } = useTheme();
  return <div className="mx-auto max-w-5xl pb-8">
    <header className="flex items-center justify-between gap-3 py-3">
      <Link href="/" className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white"><IconClock size={23} /></span>TaskTimmer</Link>
      <Button variant="ghost" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</Button>
    </header>
    <div className="grid items-center gap-10 py-10 lg:grid-cols-2 lg:gap-20 lg:py-20">
      <section className="hidden lg:block">
        <p className="tt-eyebrow mb-5">A little more intention</p>
        <h2 className="max-w-md text-5xl font-bold leading-[1.12] tracking-tight">Make time for<br /><span className="text-indigo-600 dark:text-indigo-300">what matters.</span></h2>
        <p className="tt-text-muted mt-6 max-w-sm text-lg">A calm place to plan your week, focus on an activity, and see where your time goes.</p>
        <div className="mt-9 space-y-5">
          {[{ icon:IconClock, title:'Stay in the moment', text:'Start a timer and focus on one thing.' }, { icon:IconCalendar, title:'Make a flexible plan', text:'Create a weekly routine that works for you.' }, { icon:IconLog, title:'See your progress', text:'Build a picture of your time, at your own pace.' }].map(({ icon:Icon, title, text }) =>
            <div key={title} className="flex items-start gap-4"><span className="mt-1 text-indigo-600 dark:text-indigo-300"><Icon size={21} /></span><div><h3 className="font-semibold">{title}</h3><p className="tt-text-muted text-sm">{text}</p></div></div>)}
        </div>
      </section>
      <section className="mx-auto w-full max-w-md">
        <div className="mb-7"><h1 className="tt-heading-page">{title}</h1>{subtitle && <p className="tt-text-muted mt-3">{subtitle}</p>}</div>
        {children}
        <p className="tt-text-muted mt-6 text-center text-xs">Your pace. Your priorities. Your time.</p>
      </section>
    </div>
  </div>;
}
export function AuthCard({ children }: { children:React.ReactNode }) { return <div className="tt-panel p-6 sm:p-8">{children}</div>; }

