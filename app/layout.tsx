import './globals.css';
import React from 'react';
import { Inter } from 'next/font/google';
import Providers from '../components/Providers';
import { ToastProvider } from '../components/toast/ToastProvider';
import { Navbar } from '../components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'TaskTimmer',
  description: 'Activity-based time management'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
  <html lang="en">
    <body className={inter.className + ' min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors'}>
        <Providers>
          <ToastProvider>
            <div className="max-w-5xl mx-auto p-4">
              <Navbar />
              {children}
            </div>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
