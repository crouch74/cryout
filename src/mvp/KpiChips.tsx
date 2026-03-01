import { useState } from 'react';
import { t } from '../i18n/index.ts';

interface KpiChipItem {
  id: string;
  label: string;
  value: string;
  detail: string;
  severity?: 'normal' | 'elevated' | 'high' | 'critical';
  gaugePercent?: number;
}

interface KpiChipsProps {
  items: KpiChipItem[];
}

export function KpiChips({ items }: KpiChipsProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="seal-strip" role="list" aria-label={t('ui.game.scenarioMetrics', 'Scenario metrics')}>
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div
            key={item.id}
            className={`seal-plaque ${isOpen ? 'is-open' : ''}`}
            role="listitem"
            data-severity={item.severity ?? 'normal'}
          >
            <button
              type="button"
              className="seal-plaque-button"
              aria-expanded={isOpen}
              onClick={() => setOpenId((current) => (current === item.id ? null : item.id))}
            >
              <span className="engraved-eyebrow">{item.label}</span>
              <strong>{item.value}</strong>
            </button>
            {item.gaugePercent !== undefined ? (
              <div className="seal-gauge" aria-hidden="true">
                <div className="seal-gauge-fill" style={{ width: `${item.gaugePercent}%` }} />
              </div>
            ) : null}
            <p>{item.detail}</p>
          </div>
        );
      })}
    </div>
  );
}
