import React from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '../lib/nextAuthOptions';
import { redirect } from 'next/navigation';

export default async function Protected({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions as any);
  if (!session || !(session as any).userId) {
    redirect('/login');
  }
  return <>{children}</>;
}
