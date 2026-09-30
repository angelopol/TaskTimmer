"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import SignOutButton from './SignOutButton';
import { useTheme } from './ThemeProvider';
import { IconClock, IconCalendar, IconLayers, IconLog, IconSun, IconMoon } from './ui/icons';
import { IconButton } from './ui/Button';

const links = [
  { href:'/', label:'Overview', icon:IconClock },
  { href:'/activities', label:'Activities', icon:IconLayers },
  { href:'/schedule', label:'Schedule', icon:IconCalendar },
  { href:'/logs', label:'Time log', icon:IconLog }
];
export function Navbar() {
  const { data:session } = useSession();
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  if (!(session as any)?.userId) return null;
  return <header className="border-b border-slate-200 pt-5 dark:border-slate-700">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <Link href="/" className="inline-flex items-center gap-2.5 font-bold tracking-tight text-lg" aria-label="TaskTimmer home">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white"><IconClock size={23} /></span>
        TaskTimmer
      </Link>
      <div className="flex items-center gap-1 sm:gap-3">
        <span className="tt-text-muted hidden max-w-40 truncate text-sm md:block">{session?.user?.name}</span>
        <IconButton variant="ghost" onClick={toggle} label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} icon={theme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />} />
        <SignOutButton />
      </div>
    </div>
    <nav aria-label="Main navigation" className="grid grid-cols-4 gap-1 sm:flex sm:gap-2">
      {links.map(({ href, label, icon:Icon }) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}
        className={'flex min-h-14 flex-col items-center justify-center gap-1 rounded-t-xl border-b-2 px-2 py-3 text-xs font-semibold sm:min-h-12 sm:flex-row sm:gap-2 sm:px-5 sm:text-sm ' + (pathname === href ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-200' : 'border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>
        <Icon size={18} />{label}
      </Link>)}
    </nav>
  </header>;
}
