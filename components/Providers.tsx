"use client";
import { SessionProvider } from 'next-auth/react';
import React from 'react';
import { ThemeProvider } from './ThemeProvider';
import { UnitProvider } from './UnitProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <UnitProvider>
          {children}
        </UnitProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
