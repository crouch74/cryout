import type { ReactNode } from 'react';

export function ThemePlate({
  label,
  active,
  disabled,
  variant = 'default',
  size = 'md',
  className = '',
  ariaLabel,
  onClick,
}: {
  label: ReactNode;
  active?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'danger' | 'ghost' | 'neutral' | 'default' | 'quiet' | 'utility';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  ariaLabel?: string;
  onClick: () => void;
}) {
  const variantName = ({
    default: 'neutral',
    quiet: 'ghost',
    utility: 'ghost',
    primary: 'primary',
    danger: 'danger',
    ghost: 'ghost',
    neutral: 'neutral',
  } as const)[variant];

  return (
    <button
      type="button"
      className={`engraved-plate engraved-plate-${variantName} engraved-plate-${size} ${active ? 'is-active' : ''} ${className}`.trim()}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
