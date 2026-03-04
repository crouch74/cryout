import { GameIcon } from './GameIcon.tsx';
import type { GameIconSize } from './GameIcon.tsx';
import type { IconBaseShape, IconState, IconType } from './iconTypes.ts';

interface IconProps {
  type: IconType;
  size?: GameIconSize | number;
  strokeWidth?: number;
  state?: IconState;
  baseShape?: IconBaseShape;
  title?: string;
  ariaLabel?: string;
  ariaHidden?: boolean;
  className?: string;
}

export function Icon({
  type,
  size,
  strokeWidth,
  title,
  ariaLabel,
  ariaHidden,
  className,
}: IconProps) {
  return (
    <GameIcon
      name={type}
      size={size}
      strokeWidth={strokeWidth}
      title={title}
      ariaLabel={ariaLabel}
      ariaHidden={ariaHidden}
      className={className}
    />
  );
}
