import React from 'react';
import { AuthForm } from '../../../components/AuthForm';
import { AuthLayout, AuthCard } from '../../../components/auth/AuthLayout';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/nextAuthOptions';
import { redirect } from 'next/navigation';

export default async function LoginPage() {
  const session = await getServerSession(authOptions as any);
  if (session) redirect('/');
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue tracking your time">
      <AuthCard>
        <AuthForm mode="login" />
      </AuthCard>
    </AuthLayout>
  );
}
