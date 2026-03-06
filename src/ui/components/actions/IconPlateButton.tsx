import type { ReactNode } from 'react';
import type { GameIconName } from '../../icon/iconTypes.ts';
import { GameIcon } from '../../icon/GameIcon.tsx';
import { ThemePlate } from '../../layout/ThemePlate.tsx';
import './ui-button.css';

interface IconPlateButtonProps {
  icon: GameIconName;
  label: ReactNode;
  variant?: 'primary' | 'danger' | 'ghost' | 'neutral' | 'default' | 'quiet' | 'utility';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  active?: boolean;
  ariaLabel?: string;
  className?: string;
  iconClassName?: string;
  onClick: () => void;
}

export function IconPlateButton({
  icon,
  label,
  variant,
  size,
  disabled,
  active,
  ariaLabel,
  className,
  iconClassName,
  onClick,
}: IconPlateButtonProps) {
  return (
    <ThemePlate
      size={size}
      variant={variant}
      disabled={disabled}
      active={active}
      ariaLabel={ariaLabel}
      className={className}
      onClick={onClick}
      label={(
        <span className="plate-label-with-icon">
          <GameIcon name={icon} size="xs" className={iconClassName} ariaLabel={ariaLabel ?? (typeof label === 'string' ? label : undefined)} />
          <span>{label}</span>
        </span>
      )}
    />
  );
}
