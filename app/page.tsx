import React from 'react';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '../lib/nextAuthOptions';
import SignOutButton from '../components/SignOutButton';
import { DashboardWeekly } from '../components/DashboardWeekly';

export default async function Home() {
  const session = await getServerSession(authOptions as any);
  if (!session) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">TaskTimmer</h1>
        <p>
          <Link className="text-blue-600 underline" href="/login">Login</Link> or{' '}
          <Link className="text-blue-600 underline" href="/register">Register</Link>
        </p>
      </div>
    );
  }
  return <DashboardWeekly />;
}
