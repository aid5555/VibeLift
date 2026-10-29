import type { ButtonHTMLAttributes, ReactElement } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100',
};

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonProps): ReactElement {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className ?? ''}`}
      {...props}
    />
  );
}
