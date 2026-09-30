"use client";
import React from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'subtle' | 'ghost';
type Size = 'sm' | 'md';
const variants: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  subtle: 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
  ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
};
export function buttonStyles(variant: Variant = 'primary', size: Size = 'sm') {
  return 'inline-flex min-h-11 items-center justify-center rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ' +
    (size === 'md' ? 'px-5 py-3 text-sm gap-2 ' : 'px-3.5 py-2 text-sm gap-2 ') + variants[variant];
}
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: Size; leftIcon?: React.ReactNode; rightIcon?: React.ReactNode; loading?: boolean;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = 'primary', size = 'sm', leftIcon, rightIcon, loading, children, className = '', disabled, type = 'button', ...rest
}, ref) {
  return <button ref={ref} type={type} className={buttonStyles(variant, size) + ' ' + className} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
    {loading ? <span aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" /> : leftIcon && <span aria-hidden="true" className="shrink-0">{leftIcon}</span>}
    {children}
    {!loading && rightIcon && <span aria-hidden="true">{rightIcon}</span>}
  </button>;
});
export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'leftIcon' | 'rightIcon'> { icon: React.ReactNode; label: string; }
export function IconButton({ icon, label, className = '', ...props }: IconButtonProps) {
  return <Button {...props} aria-label={label} title={label} className={'w-11 shrink-0 !px-0 ' + className}>{icon}</Button>;
}

