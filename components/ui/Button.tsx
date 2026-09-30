"use client";
import React from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'subtle' | 'ghost';
type Size = 'sm' | 'md';
const variants: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20',
  secondary: 'border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-2)]',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  subtle: 'bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--line)]',
  ghost: 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
};
export function buttonStyles(variant: Variant = 'primary', size: Size = 'sm') {
  return 'inline-flex min-h-11 items-center justify-center rounded-xl font-semibold transition-[background-color,color,transform] active:scale-[.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ' +
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
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ icon, label, className = '', ...props }, ref) {
  return <Button ref={ref} {...props} aria-label={label} title={props.title ?? label} className={'w-11 shrink-0 !px-0 ' + className}>{icon}</Button>;
});
