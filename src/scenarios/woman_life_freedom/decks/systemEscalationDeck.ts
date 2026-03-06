import type { SystemCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const systemCards: SystemCardDefinition[] = [
    {
        id: 'sys_wlf_hijab_crackdown',
        deck: 'system',
        name: 'Hijab Crackdown',
        text: 'The System moves first and forces a hard turn. The regime enforces modesty laws systematically. The coalition must absorb this pressure and reorganize before the next phase.',
        onReveal: [
            { type: 'modify_domain', domain: 'PatriarchalGrip', delta: 1 },
            { type: 'modify_war_machine', delta: 1 }
        ],
        persistentModifiers: {
            outreachCostDelta: 1
        }
    }
];
