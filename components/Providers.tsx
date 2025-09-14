"use client";
import { SessionProvider } from 'next-auth/react';
import React from 'react';
import { ThemeProvider } from './ThemeProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
