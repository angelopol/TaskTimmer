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
  description: 'Activity-based time management'
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
    <body className={inter.className + ' min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors'}>
        <Providers>
          <WeekProvider>
            <ToastProvider>
              <div className="max-w-5xl mx-auto p-4">
                <Navbar />
                <PageTransition>
                  {children}
                </PageTransition>
                <PWARegister />
              </div>
            </ToastProvider>
          </WeekProvider>
        </Providers>
      </body>
    </html>
  );
}
