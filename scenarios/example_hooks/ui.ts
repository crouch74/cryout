export const ui = {
  getLabel(id: string, fallback?: string) {
    const labels: Record<string, string> = {
      hope: 'Hope',
      pressure: 'Pressure',
      commons: 'Commons',
      organize_cells: 'Organize Cells',
      archive_testimony: 'Archive Testimony',
      collective_breath: 'Collective Breath',
    };
    return labels[id] ?? fallback ?? id;
  },
  getTrackOrder() {
    return ['hope', 'pressure'];
  },
  getZoneOrder() {
    return ['commons'];
  },
  formatEvent(event: import('../types.ts').StructuredEvent) {
    return `${event.type}:${JSON.stringify(event.payload)}`;
  },
  formatResult(result: import('../types.ts').GameResult) {
    return `${result.status}:${result.reasonId}`;
  },
};
