import type { ResistanceCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const resistanceCards: ResistanceCardDefinition[] = [
    {
        id: 'res_wlf_vpn_network',
        deck: 'resistance',
        type: 'support',
        name: 'VPN Network',
        text: 'Acting faction gains 2 Evidence. This support helps against Silenced Truth pressure and internet blackout penalties.',
        domainBonus: 'SilencedTruth',
        campaignBonus: 1,
        effects: [
            { type: 'gain_evidence', seat: 'acting_player', amount: 2 }
        ]
    },
    {
        id: 'res_wlf_cutting_hair_symbol',
        deck: 'resistance',
        type: 'action',
        name: 'Cutting Hair Solidarity',
        text: 'Raise Global Gaze by 2 for the coalition.',
        effects: [
            { type: 'modify_gaze', delta: 2 }
        ]
    },
    {
        id: 'res_wlf_diaspora_protest',
        deck: 'resistance',
        type: 'action',
        name: 'Diaspora Protest Rally',
        text: 'Add 2 Comrades to the target region for the acting faction.',
        effects: [
            { type: 'add_comrades', region: 'target_region', seat: 'acting_player', amount: 2 }
        ]
    }
];
