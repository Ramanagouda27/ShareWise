import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

    const variants = {
      primary:
        'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs shadow-blue-500/10 hover:shadow-sm border border-blue-600',
      secondary:
        'bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white shadow-xs border border-neutral-900',
      outline:
        'bg-white hover:bg-neutral-50 active:bg-neutral-100 text-neutral-800 border border-neutral-200 shadow-2xs hover:border-neutral-300',
      ghost:
        'bg-transparent hover:bg-neutral-100/80 active:bg-neutral-200/80 text-neutral-700 hover:text-neutral-900',
      danger:
        'bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 shadow-2xs',
    };

    const sizes = {
      sm: 'text-xs h-8 px-3 rounded-lg gap-1.5',
      md: 'text-sm h-10 px-4 rounded-xl gap-2',
      lg: 'text-base h-12 px-5 rounded-xl gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-current" />}
        {!isLoading && leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
