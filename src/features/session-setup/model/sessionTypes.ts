import type { FactionId, RegionId, VictoryMode } from '../../../engine/index.ts';

export interface SessionSetupDraft {
  surface: 'local' | 'room';
  rulesetId: string;
  mode: VictoryMode;
  humanPlayerCount: 2 | 3 | 4;
  factionIds: FactionId[];
  seatOwnerIds: number[];
  seed: number;
}

export interface SessionViewport {
  focusedSeat: number;
  regionId: RegionId | null;
  eventSeq: number | null;
}

export const DEFAULT_SESSION_VIEWPORT: SessionViewport = {
  focusedSeat: 0,
  regionId: null,
  eventSeq: null,
};

export type SetupConfig = SessionSetupDraft;
export type GameViewState = SessionViewport;
export const DEFAULT_GAME_VIEW_STATE = DEFAULT_SESSION_VIEWPORT;
