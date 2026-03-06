import type { SystemCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const systemCards: SystemCardDefinition[] = [
    {
        id: 'sys_tahrir_state_of_emergency',
        deck: 'system',
        name: 'State of Emergency',
        text: 'The System moves first and forces a hard turn. The interior ministry locks down transit. The coalition must absorb this pressure and reorganize before the next phase.',
        onReveal: [
            { type: 'add_extraction', region: 'Cairo', amount: 1 },
            { type: 'modify_war_machine', delta: 1 }
        ],
        persistentModifiers: {
            campaignTargetDelta: 1
        }
    }
];
