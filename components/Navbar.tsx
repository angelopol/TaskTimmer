"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import SignOutButton from './SignOutButton';
import { useTheme } from './ThemeProvider';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/activities', label: 'Activities' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/logs', label: 'Log Time' }
];

export function Navbar() {
  const { data: session } = useSession();
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const userId = (session as any)?.userId;
  if (!userId) return null;
  return (
    <nav className="flex flex-wrap items-center gap-4 mb-6 border-b pb-2 text-sm border-gray-200 dark:border-gray-700">
      <Link href="/" className="flex items-center gap-2 font-semibold mr-4 group">
        <span className="w-7 h-7 rounded-md overflow-hidden shadow ring-1 ring-black/30 bg-gray-900 group-hover:scale-105 transition-transform">
          <img src="/icon-clock-pixel.svg" alt="TaskTimmer logo" className="w-full h-full object-contain p-1 select-none" draggable={false} />
        </span>
        <span className="tracking-tight text-base">TaskTimmer</span>
        <span className="sr-only">Home</span>
      </Link>
      {links.map(l => {
        const active = pathname === l.href;
        return (
          <Link key={l.href} href={l.href} className={active ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}>
            {l.label}
          </Link>
        );
      })}
      <div className="ml-auto flex items-center gap-3">
        <button onClick={toggle} aria-label="Toggle theme" className="rounded px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <SignOutButton />
      </div>
    </nav>
  );
}
