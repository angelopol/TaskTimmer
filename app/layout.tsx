import './globals.css';
import React from 'react';
import { Inter } from 'next/font/google';
import Providers from '../components/Providers';
import { ToastProvider } from '../components/toast/ToastProvider';
import { WeekProvider } from '../components/week/WeekContext';
import { Navbar } from '../components/Navbar';
import { PageTransition } from '../components/PageTransition';
import { PWARegister } from '../components/PWARegister';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'TaskTimmer',
  description: 'Plan your week, track your activities, and make time for what matters.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
  <html lang="en">
    <head>
      <link rel="manifest" href="/manifest.webmanifest" />
      <meta name="theme-color" content="#111827" />
      <link rel="icon" type="image/svg+xml" href="/icon-clock-pixel.svg" />
      <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="TaskTimmer" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="application-name" content="TaskTimmer" />
      <meta name="description" content="Activity-based time management" />
      <meta name="color-scheme" content="light dark" />
    </head>
    <body className={inter.className + ' min-h-screen'}>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <Providers>
          <WeekProvider>
            <ToastProvider>
              <div className="app-shell">
                <Navbar />
                <main id="main-content" tabIndex={-1} className="app-main">
                <PageTransition>
                  {children}
                </PageTransition>
                </main>
                <PWARegister />
              </div>
            </ToastProvider>
          </WeekProvider>
        </Providers>
      </body>
    </html>
  );
}
