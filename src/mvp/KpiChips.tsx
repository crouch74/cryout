import { useState } from 'react';

interface KpiChipItem {
  id: string;
  label: string;
  value: string;
  detail: string;
}

interface KpiChipsProps {
  items: KpiChipItem[];
}

export function KpiChips({ items }: KpiChipsProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="game-header-kpis" role="list" aria-label="Scenario metrics">
      {items.map((item) => {
        const isOpen = openId === item.id;

        return (
          <div
            key={item.id}
            className={`game-kpi-chip ${isOpen ? 'is-open' : ''}`}
            role="listitem"
            onMouseEnter={() => setOpenId(item.id)}
            onMouseLeave={() => setOpenId((current) => (current === item.id ? null : current))}
          >
            <button
              type="button"
              className="game-kpi-trigger"
              aria-expanded={isOpen}
              onClick={() => setOpenId((current) => (current === item.id ? null : item.id))}
            >
              <span className="eyebrow">{item.label}</span>
              <strong>{item.value}</strong>
            </button>
            <p className="game-kpi-detail">{item.detail}</p>
          </div>
        );
      })}
    </div>
  );
}
