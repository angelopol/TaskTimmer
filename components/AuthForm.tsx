"use client";
import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, IconButton } from './ui/Button';
import { IconEye, IconEyeOff } from './ui/icons';
import { ErrorState } from './ui/Feedback';

export function AuthForm({ mode, onSuccess }: { mode:'login' | 'register'; onSuccess?:()=>void }) {
  const creating = mode === 'register';
  const [error, setError] = useState('');
  const [remember, setRemember] = useState(false);
  const [visible, setVisible] = useState(false);
  const schema = z.object({
    name:creating ? z.string().trim().min(2, 'Enter at least 2 characters.').max(60, 'Use 60 characters or fewer.') : z.string().optional(),
    email:z.string().trim().email('Enter a valid email address.'),
    password:z.string().min(creating ? 6 : 1, creating ? 'Use at least 6 characters.' : 'Enter your password.')
  });
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, formState:{ errors, isSubmitting } } = useForm<Values>({ resolver:zodResolver(schema), mode:'onBlur' });
  async function submit(values:Values) {
    setError('');
    try {
      if (creating) {
        const response = await fetch('/api/auth/register', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(values) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(response.status === 409 ? 'This email already has an account. Please sign in.' : typeof data.error === 'string' ? data.error : 'We could not create your account. Please try again.');
      }
      const result = await signIn('credentials', { redirect:false, email:values.email, password:values.password, remember:remember ? '1' : '0' });
      if (!result?.ok || result.error) throw new Error('We could not sign you in. Check your email and password and try again.');
      onSuccess?.(); window.location.replace('/');
    } catch (reason) {
      setError(reason instanceof Error && reason.message !== 'Failed to fetch' ? reason.message : 'Unable to connect. Check your internet connection and try again.');
    }
  }
  return <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5" aria-busy={isSubmitting}>
    {creating && <div><label htmlFor="name" className="tt-label">Your name</label><input id="name" autoComplete="name" className="tt-input" placeholder="How should we call you?" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined} {...register('name')} />{errors.name && <p id="name-error" className="mt-2 text-sm text-red-700 dark:text-red-300">{errors.name.message}</p>}</div>}
    <div><label htmlFor="email" className="tt-label">Email address</label><input id="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} className="tt-input" placeholder="you@example.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} {...register('email')} />{errors.email && <p id="email-error" className="mt-2 text-sm text-red-700 dark:text-red-300">{errors.email.message}</p>}</div>
    <div><label htmlFor="password" className="tt-label">Password</label><div className="relative">
      <input id="password" type={visible ? 'text' : 'password'} autoComplete={creating ? 'new-password' : 'current-password'} className="tt-input !pr-14" aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : creating ? 'password-help' : undefined} {...register('password')} />
      <IconButton className="absolute right-1 top-1/2 -translate-y-1/2" icon={visible ? <IconEyeOff size={19} /> : <IconEye size={19} />} label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} variant="ghost" onClick={() => setVisible(!visible)} />
    </div>{creating && <p id="password-help" className="tt-text-muted mt-2 text-sm">Use at least 6 characters. A longer password is more secure.</p>}{errors.password && <p id="password-error" className="mt-2 text-sm text-red-700 dark:text-red-300">{errors.password.message}</p>}</div>
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />Keep me signed in on this device</label>
    {error && <ErrorState message={error} />}
    <Button type="submit" size="md" loading={isSubmitting} className="w-full">{isSubmitting ? (creating ? 'Creating your account…' : 'Signing in…') : creating ? 'Create account' : 'Sign in'}</Button>
    <p className="tt-text-muted pt-2 text-center text-sm">{creating ? 'Already have an account?' : 'New to TaskTimmer?'}{' '}<Link className="tt-link" href={creating ? '/login' : '/register'}>{creating ? 'Sign in' : 'Create an account'}</Link></p>
  </form>;
}

