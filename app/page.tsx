import React from 'react';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '../lib/nextAuthOptions';

export default async function Home() {
  const session = await getServerSession(authOptions as any);
  if (!session) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">TaskTimmer</h1>
        <p>
          <Link className="text-blue-600 underline" href="/login">Login</Link> o{' '}
          <Link className="text-blue-600 underline" href="/register">Registro</Link>
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard (placeholder)</h1>
      <p>Próximamente: resumen semanal.</p>
      <form action="/api/auth/logout" method="post">
        <button className="text-sm text-red-600 underline">Logout</button>
      </form>
    </div>
  );
}
