import type { SystemCardDefinition } from '../../../engine/types.ts';

export const systemCards: SystemCardDefinition[] = [
    {
        id: 'sys_tahrir_state_of_emergency',
        deck: 'system',
        name: 'State of Emergency',
        text: 'The interior ministry locks down transit.',
        onReveal: [
            { type: 'add_extraction', region: 'Cairo', amount: 1 },
            { type: 'modify_war_machine', delta: 1 }
        ],
        persistentModifiers: {
            campaignTargetDelta: 1
        }
    }
];
