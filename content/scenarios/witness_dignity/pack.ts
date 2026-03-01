import type { PackDefinition } from '../../../engine/types.ts';

const pack: PackDefinition = {
  id: 'witness_dignity',
  type: 'scenario',
  version: '1.0.0',
  dependsOn: ['base'],
  scenario: {
    id: 'witness_dignity',
    name: 'Witness & Dignity',
    description: 'Palestine, Lebanon, and Egypt sit under stacked war, rights, and border pressure while climate accelerates the broader crisis.',
    introduction:
      'A coalition of organizers, journalists, lawyers, and planners works across a narrowing civic landscape to protect civilians, keep truth moving, and build institutions that can outlast the Capture Engine.',
    story:
      'Witness & Dignity keeps Palestine as the moral center of the scenario framing without reducing it to spectacle. The coalition acts under severe pressure, trying to hold open corridors of care, remedy, and testimony across Palestine, Lebanon, and Egypt while climate stress compounds every front.',
    dramatization:
      'The table should feel like an emergency newsroom, a legal triage room, and a mutual-aid corridor all at once. Every gain is fragile. Every delay has a civilian cost. The scenario is written to keep witness, care, and political clarity in the foreground rather than spectacle.',
    gameplay:
      'Witness & Dignity opens under immediate pressure. War, rights, and poverty all threaten to outrun the coalition before long-term institutions can stabilize the map. The strongest line of play is coordinated pacing: protect Palestine from spiraling displacement while building enough evidence and solidarity to unlock charter progress across nearby corridors.',
    mechanics:
      'The scenario rewards public testimony and careful timing. Witness Window cancels the first disinformation placement in a round when the coalition keeps evidence high, while Aid Corridor punishes unchecked war pressure by locking access in Palestine. Expect a tighter, more tactical game with fewer safe turns and heavier emphasis on media, legal, and relief sequencing.',
    moralCenter: 'Palestine is framed as the moral center: rights-focused, unsensational, and grounded in civilian protection.',
    setup: {
      civicSpace: 'NARROWED',
      temperature: 2,
      resources: {
        solidarity: 2,
        evidence: 2,
        capacity: 1,
        relief: 0,
      },
      frontOverrides: {
        WAR: { pressure: 6, protection: 2, impact: 4 },
        CLIMATE: { pressure: 3, protection: 3, impact: 2 },
        RIGHTS: { pressure: 5, protection: 3, impact: 3 },
        SPEECH_INFO: { pressure: 4, protection: 4, impact: 2 },
        POVERTY: { pressure: 5, protection: 2, impact: 4 },
        ENERGY: { pressure: 3, protection: 4, impact: 2 },
        CULTURE: { pressure: 2, protection: 5, impact: 1 },
      },
      regionOverrides: {
        Palestine: {
          tokens: { displacement: 2, disinfo: 0, compromise_debt: 0 },
          locks: [],
          vulnerability: { WAR: 3, RIGHTS: 3, SPEECH_INFO: 2, POVERTY: 1 },
        },
        Lebanon: {
          vulnerability: { WAR: 2, RIGHTS: 2, SPEECH_INFO: 2, POVERTY: 2 },
        },
        Egypt: {
          vulnerability: { POVERTY: 3, RIGHTS: 2, ENERGY: 2, CLIMATE: 2 },
        },
        Sudan: {
          vulnerability: { WAR: 3, POVERTY: 3, RIGHTS: 2, CLIMATE: 2 },
        },
      },
    },
    specialRuleChips: [
      {
        id: 'witness_window',
        label: 'Witness Window',
        description: 'If evidence is at least 3, the first disinfo placement each round is cancelled.',
        flagKey: 'witness_window_available',
      },
      {
        id: 'aid_corridor',
        label: 'Aid Corridor',
        description: 'When WAR pressure reaches 8, Palestine gains an AidAccess lock until Organizer or Lawyer clears it.',
      },
    ],
    roundLimit: {
      CORE: 8,
      FULL: 12,
    },
    hooks: [
      {
        id: 'witness_window_reset',
        hook: 'on_round_start',
        when: {
          kind: 'compare',
          left: { type: 'resource', resource: 'evidence' },
          op: '>=',
          right: 3,
        },
        emoji: '🛰️',
        message: 'Witness Window is available this round.',
        effects: [{ type: 'set_flag', scope: 'round', key: 'witness_window_available', value: true }],
      },
      {
        id: 'aid_corridor_trigger',
        hook: 'on_capture_card_resolve',
        when: {
          kind: 'all',
          conditions: [
            { kind: 'compare', left: { type: 'front_stat', front: 'WAR', stat: 'pressure' }, op: '>=', right: 8 },
            { kind: 'not', condition: { kind: 'hasLock', region: 'Palestine', lock: 'AidAccess' } },
          ],
        },
        emoji: '❌',
        message: 'Aid Corridor closes in Palestine.',
        effects: [{ type: 'add_lock', region: 'Palestine', lock: 'AidAccess' }],
      },
    ],
  },
};

export default pack;
