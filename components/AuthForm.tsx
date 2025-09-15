"use client";
import React, { useState, useMemo } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from './toast/ToastProvider';

interface Props {
  mode: 'login' | 'register';
  onSuccess?: () => void;
}

export const AuthForm: React.FC<Props> = ({ mode, onSuccess }) => {
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [remember, setRemember] = useState(true);
  const { addToast } = useToast();

  const baseSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'Mínimo 6 caracteres')
  });
  const registerSchema = baseSchema.extend({
    name: z.string().min(2, 'Nombre muy corto').max(60, 'Nombre muy largo')
  });
  const schema = mode === 'register' ? registerSchema : baseSchema;

  type FormValues = z.infer<typeof schema>;

  const { register, handleSubmit, formState, watch, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur'
  });
  const { errors, isSubmitting, isValidating } = formState;

  const passwordValue = watch('password') || '';

  // Simple password strength heuristic
  const strength = useMemo(() => {
    if (!passwordValue) return { score: 0, label: 'Empty', color: 'bg-gray-600' };
    let score = 0;
    if (passwordValue.length >= 6) score++;
    if (passwordValue.length >= 10) score++;
    if (/[A-Z]/.test(passwordValue)) score++;
    if (/[a-z]/.test(passwordValue)) score++;
    if (/\d/.test(passwordValue)) score++;
    if (/[^A-Za-z0-9]/.test(passwordValue)) score++;
    const pct = Math.min(100, Math.round((score / 6) * 100));
    let label = 'Weak';
    if (pct >= 80) label = 'Strong'; else if (pct >= 55) label = 'Medium';
    const color = pct >= 80 ? 'bg-green-500' : pct >= 55 ? 'bg-yellow-500' : 'bg-red-500';
    return { score: pct, label, color };
  }, [passwordValue]);

  async function onSubmit(values: FormValues) {
    setError('');
    setStatusMsg(mode === 'register' ? 'Creating account…' : 'Checking credentials…');
    try {
      if (mode === 'register') {
        const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
        if (!res.ok) {
          const j = await res.json().catch(()=>({}));
          throw new Error(j.error || 'Registration error');
        }
      }
      const result = await signIn('credentials', { redirect: false, email: (values as any).email, password: (values as any).password, remember: remember ? '1' : '0' });
      if (result?.error) throw new Error(result.error || 'Invalid credentials');
  addToast({ type: 'success', message: mode === 'register' ? 'Account created' : 'Welcome back' });
  onSuccess?.();
  // Slight delay so user sees toast before navigation (SW/app router may still keep toast if provider is global)
  setTimeout(()=>{ window.location.replace('/'); }, 120);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setStatusMsg('');
    }
  }

  const otherMode = mode === 'login' ? 'register' : 'login';
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="tt-form-grid gap-4">
      {mode === 'register' && (
        <div className="col-span-full">
          <label className="block text-sm font-medium mb-1" htmlFor="name">Name</label>
          <input id="name" className="tt-input w-full" placeholder="Your name" autoComplete="name" {...register('name' as any)} />
          {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
        </div>
      )}
      <div className="col-span-full">
        <label className="block text-sm font-medium mb-1" htmlFor="email">Email</label>
        <input id="email" className="tt-input w-full" placeholder="you@example.com" autoComplete="email" inputMode="email" {...register('email')} />
        {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
      </div>
      <div className="col-span-full">
        <label className="block text-sm font-medium mb-1" htmlFor="password">Password</label>
        <input id="password" type="password" className="tt-input w-full" placeholder="********" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} {...register('password')} />
        {mode === 'register' && (
          <div className="mt-2 space-y-1">
            <div className="h-2 w-full bg-gray-700 rounded overflow-hidden">
              <div className={`h-full transition-all duration-300 ${strength.color}`} style={{ width: `${strength.score}%` }} />
            </div>
            <p className="text-xs text-gray-400 flex justify-between"><span>Password strength:</span><span className={`font-medium ${strength.color.replace('bg-','text-')}`}>{strength.label}</span></p>
          </div>
        )}
        {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
      </div>
      <div className="col-span-full flex items-center justify-between text-xs select-none">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            id="remember"
            type="checkbox"
            className="h-4 w-4 rounded border-gray-600 bg-gray-800"
            checked={remember}
            onChange={e => setRemember(e.target.checked)}
          />
          <span className="text-gray-300">Remember me</span>
        </label>
        <span className="text-gray-500">{mode === 'login' ? 'Min 6 chars' : strength.label === 'Strong' ? 'Great password!' : 'Aim for Strong'}</span>
      </div>
      {error && <p className="col-span-full text-red-400 text-sm font-medium" role="alert">{error}</p>}
      <div className="col-span-full space-y-2">
        <button
          disabled={isSubmitting || isValidating}
          className="w-full inline-flex justify-center items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 active:bg-blue-700 transition-colors text-white font-medium py-2.5 disabled:opacity-50 disabled:cursor-not-allowed shadow focus:outline-none focus-visible:ring focus-visible:ring-blue-400/60">
          {isSubmitting ? (mode === 'login' ? 'Signing in…' : 'Creating…') : (mode === 'login' ? 'Sign in' : 'Create account')}
        </button>
        {(statusMsg || isValidating) && (
          <p className="text-center text-xs text-gray-400 h-4" role="status">
            {statusMsg || 'Validating…'}
          </p>
        )}
        {!statusMsg && !isValidating && <div className="h-4" />}
        <p className="text-center text-sm text-gray-400">
          {mode === 'login' ? 'No account?' : 'Already have an account?'}{' '}
          <Link href={`/${otherMode}`} className="text-blue-400 hover:text-blue-300 font-medium underline underline-offset-2">
            {mode === 'login' ? 'Register' : 'Login'}
          </Link>
        </p>
      </div>
    </form>
  );
};
