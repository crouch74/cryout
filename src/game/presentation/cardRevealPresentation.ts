import type { CardRevealEvent, CompiledContent, DomainEvent, EngineState, RegionId } from '../../engine/index.ts';
import {
  localizeBeaconField,
  localizeCardField,
  localizeFactionField,
  localizeRegionField,
  t,
} from '../../i18n/index.ts';

export interface PresentedRevealCopy {
  title: string;
  body: string;
  impactedRegions: string[];
  impactedFactions: string[];
}

function getRegionFromDeltaLabel(label: string, content: CompiledContent): RegionId | null {
  const regionId = (label.split('.')[0] ?? '') as RegionId;
  return content.regions[regionId] ? regionId : null;
}

function getSeatFromDeltaLabel(label: string) {
  const match = label.match(/seat:(\d+)/);
  return match ? Number(match[1]) : null;
}

function getImpactedRegionLabels(event: DomainEvent, content: CompiledContent) {
  const impacted = new Set<RegionId>();

  if (event.context?.targetRegionId && content.regions[event.context.targetRegionId]) {
    impacted.add(event.context.targetRegionId);
  }

  for (const delta of event.deltas) {
    if (delta.kind === 'extraction' || delta.kind === 'defense' || delta.kind === 'bodies' || delta.kind === 'hijab') {
      const regionId = getRegionFromDeltaLabel(delta.label, content);
      if (regionId) {
        impacted.add(regionId);
      }
    }
  }

  return Array.from(impacted).map((regionId) => localizeRegionField(regionId, 'name', content.regions[regionId].name));
}

function getImpactedFactionLabels(event: DomainEvent, content: CompiledContent, state?: EngineState) {
  if (!state) {
    return [];
  }

  const impactedSeats = new Set<number>();
  if (typeof event.context?.actingSeat === 'number') {
    impactedSeats.add(event.context.actingSeat);
  }

  for (const delta of event.deltas) {
    if (delta.kind === 'bodies' || delta.kind === 'evidence') {
      const seat = getSeatFromDeltaLabel(delta.label);
      if (seat !== null) {
        impactedSeats.add(seat);
      }
    }
  }

  return Array.from(impactedSeats).flatMap((seat) => {
    const player = state.players[seat];
    if (!player) {
      return [];
    }

    const faction = content.factions[player.factionId];
    return faction ? [localizeFactionField(faction.id, 'shortName', faction.shortName)] : [];
  });
}

export function presentRevealCopy(
  reveal: CardRevealEvent,
  content: CompiledContent,
  event?: DomainEvent,
  state?: EngineState,
): PresentedRevealCopy {
  if (reveal.deckId === 'beacon') {
    const beacon = content.beacons[reveal.cardId];
    return {
      title: localizeBeaconField(reveal.cardId, 'title', beacon?.title ?? reveal.cardId),
      body: localizeBeaconField(reveal.cardId, 'description', beacon?.description ?? ''),
      impactedRegions: [],
      impactedFactions: [],
    };
  }

  const card = content.cards[reveal.cardId];
  const baseBody = localizeCardField(reveal.cardId, 'text', card?.text ?? '');
  const impactedRegions = event ? getImpactedRegionLabels(event, content) : [];
  const impactedFactions = event ? getImpactedFactionLabels(event, content, state) : [];

  return {
    title: localizeCardField(reveal.cardId, 'name', card?.name ?? reveal.cardId),
    body: baseBody,
    impactedRegions,
    impactedFactions,
  };
}
