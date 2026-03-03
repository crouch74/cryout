import type { CoreEffect, ScenarioBehaviors } from '../../types.ts';

function nextSystemEffect(state: import('../../types.ts').CoreGameState): CoreEffect[] {
  const step = state.counters.systemSteps ?? 0;
  const variant = step % 2 === 0 ? 'raid' : 'crackdown';
  return [
    { type: 'adjustCounter', counterId: 'systemSteps', delta: 1 },
    { type: 'adjustTrack', trackId: 'pressure', delta: variant === 'raid' ? 1 : 2, clamp: { min: 0, max: 10 } },
    {
      type: 'emitEvent',
      event: {
        id: `example_hooks.system.${step}`,
        type: 'example_hooks.system_step',
        source: 'example_hooks.system',
        payload: { variant },
        tags: ['system', variant],
        level: 'info',
      },
    },
  ];
}

export const behaviors: ScenarioBehaviors = {
  actionResolvers: {
    organize_cells(_state, action) {
      return [
        { type: 'adjustTrack', trackId: 'hope', delta: 1, clamp: { min: 0, max: 10 } },
        { type: 'adjustZoneCounter', zoneId: action.zoneId ?? 'commons', counterId: 'assemblies', delta: 1 },
      ];
    },
    archive_testimony(_state, action) {
      const actorId = action.actorId ?? 'seat:0';
      return [
        { type: 'adjustPlayerResource', playerId: actorId, resourceId: 'testimony', delta: -1, clamp: { min: 0 } },
        { type: 'drawCard', deckId: 'spark', count: 1, destination: 'active', playerId: actorId },
      ];
    },
    collective_breath() {
      return [
        { type: 'adjustTrack', trackId: 'hope', delta: 1, clamp: { min: 0, max: 10 } },
        { type: 'adjustTrack', trackId: 'pressure', delta: -1, clamp: { min: 0, max: 10 } },
      ];
    },
  },
  cardResolvers: {
    resolve_scripted_breakthrough() {
      return [
        { type: 'adjustTrack', trackId: 'hope', delta: 2, clamp: { min: 0, max: 10 } },
        { type: 'setFlag', flagId: 'breakthroughResolved', value: true },
      ];
    },
  },
  deckFactories: {},
  systemTurnScript(state, scenario) {
    const policy = scenario.behaviors.weightedRandomPolicies?.system_choice?.(state, scenario) ?? [];
    const effects = nextSystemEffect(state);
    effects.push({
      type: 'emitEvent',
      event: {
        id: `example_hooks.policy.${state.counters.systemSteps ?? 0}`,
        type: 'example_hooks.weighted_policy',
        source: 'example_hooks.system',
        payload: {
          weights: policy.map((entry) => `${entry.id}:${entry.weight}`),
        },
        tags: ['system', 'weights'],
        level: 'debug',
      },
    });
    return effects;
  },
  weightedRandomPolicies: {
    system_choice(state) {
      return [
        { id: 'raid', weight: Math.max(1, 4 - state.tracks.hope.value) },
        { id: 'crackdown', weight: Math.max(1, state.tracks.pressure.value) },
      ];
    },
  },
  crisisInjectionRules: [
    (state) => (state.tracks.pressure.value >= 5
      ? [{ type: 'adjustTrack', trackId: 'pressure', delta: 1, clamp: { min: 0, max: 10 } }]
      : []),
  ],
};
