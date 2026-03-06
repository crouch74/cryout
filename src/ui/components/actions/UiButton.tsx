import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './ui-button.css';

export interface UiButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'quiet' | 'utility' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  iconOnly?: boolean;
}

export function UiButton({
  variant = 'secondary',
  size = 'md',
  icon,
  iconOnly = false,
  className = '',
  children,
  type = 'button',
  ...props
}: UiButtonProps) {
  return (
    <button
      type={type}
      className={[
        'ui-button',
        `ui-button-${variant}`,
        `ui-button-${size}`,
        iconOnly ? 'ui-button-icon-only' : '',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {iconOnly ? icon : (
        <>
          {icon ? <span className="ui-button-icon-wrap">{icon}<span>{children}</span></span> : children}
        </>
      )}
    </button>
  );
}
