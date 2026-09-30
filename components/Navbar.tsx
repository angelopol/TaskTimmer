"use client";
import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from './ThemeProvider';
import { useUnit } from './UnitProvider';
import { Menu } from './ui/Menu';
import { RemindersDialog } from './reminders/RemindersDialog';
import { IconBell, IconCalendar, IconChevronLeft, IconClock, IconDevice, IconHome, IconLayers, IconLog, IconLogout, IconMoon, IconSun } from './ui/icons';

const links = [
  { href:'/', label:'Overview', icon:IconHome },
  { href:'/activities', label:'Activities', icon:IconLayers },
  { href:'/schedule', label:'Schedule', icon:IconCalendar },
  { href:'/logs', label:'Time log', icon:IconLog }
];
// Secondary pages: titled in the app bar, with a back button on phones.
const subpages: Record<string, string> = { '/integrations/reminders':'Reminders setup' };
const isActive = (pathname:string, href:string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

function AccountMenu() {
  const { data:session } = useSession();
  const { preference, setTheme } = useTheme();
  const { unit, setUnit } = useUnit();
  const name = session?.user?.name || 'Account';
  const [reminders, setReminders] = useState(false);
  return <><Menu label="Account and settings" triggerClassName="!min-h-10 !w-10 !rounded-full !p-0"
    trigger={<span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">{name.trim().charAt(0).toUpperCase()}</span>}
    header={<div className="px-3 pb-2 pt-2"><p className="truncate font-semibold">{name}</p>{session?.user?.email && <p className="tt-text-muted truncate text-xs">{session.user.email}</p>}</div>}
    items={[
      'separator',
      { heading:'Theme' },
      { label:'System default', icon:<IconDevice size={18} />, checked:preference === 'system', onSelect:() => setTheme('system') },
      { label:'Light', icon:<IconSun size={18} />, checked:preference === 'light', onSelect:() => setTheme('light') },
      { label:'Dark', icon:<IconMoon size={18} />, checked:preference === 'dark', onSelect:() => setTheme('dark') },
      { heading:'Show time in' },
      { label:'Hours', icon:<span className="text-xs font-bold">h</span>, checked:unit === 'hr', onSelect:() => setUnit('hr') },
      { label:'Minutes', icon:<span className="text-xs font-bold">m</span>, checked:unit === 'min', onSelect:() => setUnit('min') },
      'separator',
      { label:'Apple Reminders', icon:<IconBell size={18} />, onSelect:() => setReminders(true) },
      { label:'Sign out', icon:<IconLogout size={18} />, danger:true, onSelect:() => signOut({ callbackUrl:'/login' }) }
    ]} />
    <RemindersDialog open={reminders} onClose={() => setReminders(false)} /></>;
}

export function Navbar() {
  const { data:session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  if (!(session as any)?.userId) return null;
  const current = links.find(link => isActive(pathname, link.href));
  const subtitle = subpages[pathname];
  return <header className="tt-appbar">
    <div className="tt-appbar-row">
      {subtitle && <button type="button" onClick={() => window.history.length > 1 ? router.back() : router.push('/')} aria-label="Back"
        className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-indigo-600 hover:bg-[var(--surface-2)] sm:hidden dark:text-indigo-300"><IconChevronLeft size={24} /></button>}
      <Link href="/" className="flex min-w-0 items-center gap-2.5 font-bold tracking-tight" aria-label="TaskTimmer home">
        <span className={'h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ' + (subtitle ? 'hidden sm:flex' : 'flex') + '  bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'}><IconClock size={21} /></span>
        <span className="hidden text-lg sm:inline">TaskTimmer</span>
        <span className="truncate text-lg sm:hidden">{current?.label || subtitle || 'TaskTimmer'}</span>
      </Link>
      <nav aria-label="Main navigation" className="ml-6 hidden flex-1 items-center gap-1 sm:flex">
        {links.map(({ href, label, icon:Icon }) => <Link key={href} href={href} className="tt-toplink" aria-current={isActive(pathname, href) ? 'page' : undefined}><Icon size={17} />{label}</Link>)}
      </nav>
      <div className="ml-auto"><AccountMenu /></div>
    </div>
  </header>;
}

export function TabBar() {
  const { data:session } = useSession();
  const pathname = usePathname();
  if (!(session as any)?.userId) return null;
  return <nav aria-label="Main navigation" className="tt-tabbar sm:hidden">
    {links.map(({ href, label, icon:Icon }) => <Link key={href} href={href} className="tt-tab" aria-current={isActive(pathname, href) ? 'page' : undefined}>
      <span className="tt-tab-icon"><Icon size={21} /></span>{label}
    </Link>)}
  </nav>;
}
