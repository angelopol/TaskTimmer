import React from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '../lib/nextAuthOptions';
import { DashboardWeekly } from '../components/DashboardWeekly';
import { AuthForm } from '../components/AuthForm';
import { AuthLayout, AuthCard } from '../components/auth/AuthLayout';

export default async function Home() {
  const session = await getServerSession(authOptions as any);
  if (!session || !(session as any).userId) {
    return (
      <AuthLayout title="Welcome back" subtitle="Sign in to make a little space for what matters.">
        <AuthCard>
          <AuthForm mode="login" />
        </AuthCard>
      </AuthLayout>
    );
  }
  return <DashboardWeekly />;
}
