import './globals.css';
import React from 'react';
import { Inter } from 'next/font/google';
import Providers from '../components/Providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'TaskTimmer',
  description: 'Gestión de tiempo por actividades'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className + ' min-h-screen'}>
        <Providers>
          <div className="max-w-5xl mx-auto p-4">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
