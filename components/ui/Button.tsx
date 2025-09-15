"use client";
import React from 'react';
// lightweight classnames combiner (avoid extra dependency)
function cx(...parts: Array<string | undefined | false | null>): string {
  return parts.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'danger' | 'subtle' | 'ghost';
type Size = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  asChild?: boolean; // reserved for future (e.g., slotting in Link)
}

const base = 'inline-flex items-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none transition-colors';
// Normalize heights with typical input (h-8 ~ 32px). sm ~= 30-32px, md a bit taller.
const sizeStyles: Record<Size,string> = {
  sm: 'text-xs gap-1 px-2.5 h-8',
  md: 'text-sm gap-1.5 px-3 h-9'
};
const variantStyles: Record<Variant,string> = {
  primary: 'bg-blue-600 hover:bg-blue-500 text-white focus:ring-blue-400 dark:focus:ring-offset-gray-900 shadow-sm',
  secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100 focus:ring-gray-400 dark:focus:ring-gray-500',
  danger: 'bg-red-600 hover:bg-red-500 text-white focus:ring-red-400 shadow-sm',
  subtle: 'bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100 focus:ring-gray-400',
  ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-gray-400'
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'sm',
  leftIcon,
  rightIcon,
  loading,
  children,
  className,
  disabled,
  ...rest
}) => {
  return (
    <button
  className={cx(base, sizeStyles[size], variantStyles[variant], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span className="inline-flex w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {!loading && leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
      <span className="truncate">{children}</span>
      {!loading && rightIcon ? <span className="shrink-0">{rightIcon}</span> : null}
    </button>
  );
};

export interface IconButtonProps extends Omit<ButtonProps,'children'|'leftIcon'|'rightIcon'|'size'> {
  size?: Size;
  icon: React.ReactNode;
  label?: string; // accessible label if no visible children
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  variant = 'subtle',
  size = 'sm',
  className,
  loading,
  disabled,
  ...rest
}) => {
  const dimension = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  return (
    <button
      aria-label={label}
  className={cx(base, 'justify-center', dimension, variantStyles[variant], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="inline-flex w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <span className="flex items-center justify-center" aria-hidden={label ? 'true':'false'}>{icon}</span>
      )}
    </button>
  );
};
