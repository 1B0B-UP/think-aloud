import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

interface PanelProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  variant?: 'default' | 'sheen' | 'accent';
  padded?: boolean;
}

export function Panel({ children, variant = 'default', padded = true, className, ...props }: PanelProps) {
  return (
    <section
      {...props}
      className={cx(
        variant === 'default' && 'ui-panel',
        variant === 'sheen' && 'ui-panel ui-panel-sheen',
        variant === 'accent' && 'ui-panel ui-panel-accent',
        padded && 'ui-panel-padded',
        className,
      )}
    >
      {children}
    </section>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="ui-page-header">
      <div>
        <div className="page-title">{title}</div>
        {subtitle && <div className="page-sub">{subtitle}</div>}
      </div>
      {action && <div className="ui-page-action">{action}</div>}
    </div>
  );
}
