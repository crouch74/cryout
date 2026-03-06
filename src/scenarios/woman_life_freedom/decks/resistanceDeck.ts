import type { ResistanceCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const resistanceCards: ResistanceCardDefinition[] = [
    {
        id: 'res_wlf_vpn_network',
        deck: 'resistance',
        type: 'support',
        name: 'VPN Network',
        text: 'The movement creates a brief opening through collective action and secure communication. The acting faction gains 2 Evidence, strengthening responses to Silenced Truth pressure and blackout penalties. Use this shift quickly before the System closes ranks again.',
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
        text: 'The movement creates a brief opening through collective action. Raise Global Gaze by 2 for the coalition. Use this shift quickly before the System closes ranks again.',
        effects: [
            { type: 'modify_gaze', delta: 2 }
        ]
    },
    {
        id: 'res_wlf_diaspora_protest',
        deck: 'resistance',
        type: 'action',
        name: 'Diaspora Protest Rally',
        text: 'The movement creates a brief opening through collective action. Add 3 Comrades to the target region for the acting faction. Use this shift quickly before the System closes ranks again.',
        effects: [
            { type: 'add_comrades', region: 'target_region', seat: 'acting_player', amount: 3 }
        ]
    }
];
