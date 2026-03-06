import { GameIcon } from '../../icon/GameIcon.tsx';
import { UiButton } from '../actions/UiButton.tsx';
import './copy-field.css';

export function CopyField({
  value,
  copyLabel,
  onCopy,
  ariaLabel,
  className = '',
}: {
  value: string;
  copyLabel: string;
  onCopy: () => Promise<void> | void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={['copy-field', className].filter(Boolean).join(' ')} aria-label={ariaLabel}>
      <span className="copy-field-value">{value}</span>
      <UiButton
        variant="utility"
        size="sm"
        iconOnly
        className="copy-field-action shell-icon-button"
        onClick={() => onCopy()}
        aria-label={copyLabel}
        title={copyLabel}
        icon={<GameIcon name="copy" size="sm" ariaLabel={copyLabel} />}
      />
    </div>
  );
}
