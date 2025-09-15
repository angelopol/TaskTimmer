import React from 'react';
import { AuthForm } from '../../../components/AuthForm';
import { AuthLayout, AuthCard } from '../../../components/auth/AuthLayout';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/nextAuthOptions';
import { redirect } from 'next/navigation';

export default async function RegisterPage() {
  const session = await getServerSession(authOptions as any);
  if (session) redirect('/');
  return (
    <AuthLayout title="Create your account" subtitle="Start organizing your activities and schedule">
      <AuthCard>
        <AuthForm mode="register" />
      </AuthCard>
    </AuthLayout>
  );
}
