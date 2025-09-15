"use client";
import React from 'react';
import { PageTransition } from '../PageTransition';
import Link from 'next/link';

function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-3 group">
      <span className="relative w-9 h-9 rounded-md overflow-hidden shadow ring-1 ring-black/40 bg-gray-900 group-hover:scale-105 transition-transform">
        <img
          src="/icon-clock-pixel.svg"
          alt="TaskTimmer icon"
          className="w-full h-full object-contain p-1.5 select-none"
          draggable={false}
        />
      </span>
      <span className="font-semibold tracking-tight text-white text-xl drop-shadow-sm">TaskTimmer</span>
      <span className="sr-only">Go to home</span>
    </Link>
  );
}

export function AuthLayout({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string; }) {
  return (
    <PageTransition>
      <div className="min-h-[calc(100dvh-2rem)] flex flex-col items-center justify-center py-8 px-4 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center space-y-4">
            <div className="flex justify-center"><Logo /></div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-sm">{title}</h1>
              {subtitle && <p className="text-sm text-gray-300/80">{subtitle}</p>}
            </div>
          </div>
          {children}
        </div>
      </div>
    </PageTransition>
  );
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="tt-panel tt-panel-pad-sm backdrop-blur-sm/50 border border-gray-700/60 shadow-lg shadow-black/40">
      {children}
    </div>
  );
}
