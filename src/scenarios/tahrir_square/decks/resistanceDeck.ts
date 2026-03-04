import type { ResistanceCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const resistanceCards: ResistanceCardDefinition[] = [
    {
        id: 'res_tahrir_cell_phone_video',
        deck: 'resistance',
        type: 'support',
        name: 'Cell Phone Video',
        text: 'Acting faction gains 2 Evidence. May be used on Silenced Truth campaigns or to Go Viral.',
        domainBonus: 'SilencedTruth',
        campaignBonus: 1,
        effects: [
            { type: 'gain_evidence', seat: 'acting_player', amount: 2 }
        ]
    },
    {
        id: 'res_tahrir_al_jazeera_interview',
        deck: 'resistance',
        type: 'support',
        name: 'Al Jazeera Interview',
        text: 'Acting faction gains 3 Evidence and raises Global Gaze by 1.',
        domainBonus: 'SilencedTruth',
        campaignBonus: 1,
        effects: [
            { type: 'gain_evidence', seat: 'acting_player', amount: 3 },
            { type: 'modify_gaze', delta: 1 }
        ]
    },
    {
        id: 'res_tahrir_facebook_event_page',
        deck: 'resistance',
        type: 'action',
        name: 'Facebook Event Page',
        text: 'Add 1 Comrade to Cairo for the acting faction.',
        regionBonus: 'Cairo',
        effects: [
            { type: 'add_bodies', region: 'Cairo', seat: 'acting_player', amount: 1 }
        ]
    },
    {
        id: 'res_tahrir_lawyer_brief',
        deck: 'resistance',
        type: 'action',
        name: 'Lawyer\'s Legal Brief',
        text: 'Add 1 Comrade to Alexandria for the acting faction and advance Patriarchal Grip by 1.',
        domainBonus: 'PatriarchalGrip',
        effects: [
            { type: 'modify_domain', domain: 'PatriarchalGrip', delta: 1 },
            { type: 'add_bodies', region: 'Alexandria', seat: 'acting_player', amount: 1 }
        ]
    }
];
