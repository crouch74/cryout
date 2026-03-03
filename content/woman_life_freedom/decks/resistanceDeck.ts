import type { ResistanceCardDefinition } from '../../../engine/types.ts';

export const resistanceCards: ResistanceCardDefinition[] = [
    {
        id: 'res_wlf_vpn_network',
        deck: 'resistance',
        type: 'support',
        name: 'VPN Network',
        text: '+2 Evidence. Ignore internet blackout penalties.',
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
        text: 'Raise Global Gaze by 2 instantly.',
        effects: [
            { type: 'modify_gaze', delta: 2 }
        ]
    },
    {
        id: 'res_wlf_diaspora_protest',
        deck: 'resistance',
        type: 'action',
        name: 'Diaspora Protest Rally',
        text: 'Gain +2 Bodies in any one region.',
        effects: [
            { type: 'add_bodies', region: 'target_region', seat: 'acting_player', amount: 2 }
        ]
    }
];
