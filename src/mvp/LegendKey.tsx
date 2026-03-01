interface LegendKeyProps {
  icon: string;
  label: string;
}

export function LegendKey({ icon, label }: LegendKeyProps) {
  return (
    <span className="map-legend-key">
      <span className="map-legend-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </span>
  );
}
