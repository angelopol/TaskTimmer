"use client";
import React, { useState } from 'react';
import { signIn } from 'next-auth/react';

interface Props {
  mode: 'login' | 'register';
  onSuccess?: () => void;
}

export const AuthForm: React.FC<Props> = ({ mode, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, name }) });
        if (!res.ok) {
          const j = await res.json().catch(()=>({}));
            throw new Error(j.error || 'Registration error');
        }
      }
    const result = await signIn('credentials', { redirect: false, email, password, remember: remember ? '1' : '0' });
  if (result?.error) throw new Error(result.error || 'Invalid credentials');
      onSuccess?.();
      window.location.replace('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto">
      {mode === 'register' && (
  <input className="w-full border px-3 py-2" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
      )}
      <input className="w-full border px-3 py-2" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" className="w-full border px-3 py-2" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      <div className="flex items-center gap-2 text-sm">
        <input id="remember" type="checkbox" className="h-4 w-4" checked={remember} onChange={e=>setRemember(e.target.checked)} />
        <label htmlFor="remember">Remember me</label>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50">
  {loading ? 'Submitting...' : mode === 'login' ? 'Login' : 'Sign up'}
      </button>
    </form>
  );
};
