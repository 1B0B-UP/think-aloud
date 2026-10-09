import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

type ButtonVariant = 'primary' | 'ghost' | 'quiet' | 'danger';

interface BaseProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  className?: string;
}

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement>;
type ButtonLinkProps = BaseProps & AnchorHTMLAttributes<HTMLAnchorElement>;

const variantClass: Record<ButtonVariant, string> = {
  primary: 'ui-button-primary',
  ghost: 'ui-button-ghost',
  quiet: 'ui-button-quiet',
  danger: 'ui-button-danger',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={cx('ui-button', variantClass[variant], size === 'sm' && 'ui-button-sm', className)}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  variant = 'ghost',
  size = 'md',
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <a
      {...props}
      className={cx('ui-button', variantClass[variant], size === 'sm' && 'ui-button-sm', className)}
    >
      {children}
    </a>
  );
}
