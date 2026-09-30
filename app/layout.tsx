import './globals.css';
import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Providers from '../components/Providers';
import { ToastProvider } from '../components/toast/ToastProvider';
import { WeekProvider } from '../components/week/WeekContext';
import { Navbar, TabBar } from '../components/Navbar';
import { PageTransition } from '../components/PageTransition';
import { PWARegister } from '../components/PWARegister';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TaskTimmer',
  description: 'Plan your week, track your activities, and make time for what matters.',
  applicationName: 'TaskTimmer',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/favicon.ico', sizes: '48x48' }, { url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }]
  },
  appleWebApp: { capable: true, title: 'TaskTimmer', statusBarStyle: 'black-translucent' },
  other: { 'mobile-web-app-capable': 'yes' }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f5fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0e131f' }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className + ' min-h-screen'}>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <Providers>
          <WeekProvider>
            <ToastProvider>
              <Navbar />
              <div className="app-shell">
                <main id="main-content" tabIndex={-1} className="app-main">
                  <PageTransition>
                    {children}
                  </PageTransition>
                </main>
                <TabBar />
                <PWARegister />
              </div>
            </ToastProvider>
          </WeekProvider>
        </Providers>
      </body>
    </html>
  );
}
