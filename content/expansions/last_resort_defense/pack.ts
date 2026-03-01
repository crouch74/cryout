import type { PackDefinition } from '../../../engine/types.ts';

const pack: PackDefinition = {
  id: 'last_resort_defense',
  type: 'expansion',
  version: '1.0.0',
  dependsOn: ['base'],
  expansion: {
    id: 'last_resort_defense',
    name: 'Last Resort Defense',
    enabledByDefault: false,
    actions: [
      {
        id: 'last_resort_defense',
        roleId: 'organizer',
        name: 'Last-Resort Defense',
        description: 'Reduce immediate war harm at the cost of rights, speech, and control pressure.',
        targetKind: 'REGION',
        targetLabel: 'Region',
        resolvePriority: 700,
        publicAction: true,
        burnoutCost: 2,
        effects: [
          { type: 'remove_token', region: 'target_region', token: 'displacement', count: 1 },
          { type: 'modify_front_stat', front: 'WAR', stat: 'pressure', delta: -1, clamp: { min: 0, max: 10 } },
          { type: 'modify_front_stat', front: 'RIGHTS', stat: 'impact', delta: 1, clamp: { min: 0, max: 10 } },
          { type: 'modify_front_stat', front: 'SPEECH_INFO', stat: 'pressure', delta: 1, clamp: { min: 0, max: 10 } },
        ],
      },
    ],
  },
};

export default pack;
