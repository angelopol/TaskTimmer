import React from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '../lib/nextAuthOptions';
import { DashboardWeekly } from '../components/DashboardWeekly';
import { AuthForm } from '../components/AuthForm';
import { AuthLayout, AuthCard } from '../components/auth/AuthLayout';

export default async function Home() {
  const session = await getServerSession(authOptions as any);
  if (!session) {
    return (
      <AuthLayout title="TaskTimmer" subtitle="Sign in to access your dashboard">
        <AuthCard>
          <AuthForm mode="login" />
        </AuthCard>
      </AuthLayout>
    );
  }
  return <DashboardWeekly />;
}
