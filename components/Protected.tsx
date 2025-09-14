import React from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '../lib/nextAuthOptions';
import Link from 'next/link';

export default async function Protected({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions as any);
  if (!session) {
    return <div className="p-6 text-center">No autenticado. <Link className="text-blue-600 underline" href="/login">Login</Link></div>;
  }
  return <>{children}</>;
}
