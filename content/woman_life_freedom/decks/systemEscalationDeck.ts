import type { SystemCardDefinition } from '../../../engine/types.ts';

export const systemCards: SystemCardDefinition[] = [
    {
        id: 'sys_wlf_hijab_crackdown',
        deck: 'system',
        name: 'Hijab Crackdown',
        text: 'The regime enforces modesty laws systematically.',
        onReveal: [
            { type: 'modify_domain', domain: 'PatriarchalGrip', delta: 1 },
            { type: 'modify_war_machine', delta: 1 }
        ],
        persistentModifiers: {
            outreachCostDelta: 1
        }
    }
];
