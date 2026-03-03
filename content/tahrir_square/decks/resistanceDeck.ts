import type { ResistanceCardDefinition } from '../../../engine/types.ts';

export const resistanceCards: ResistanceCardDefinition[] = [
    {
        id: 'res_tahrir_cell_phone_video',
        deck: 'resistance',
        type: 'support',
        name: 'Cell Phone Video',
        text: '+2 Evidence. May be used to Go Viral.',
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
        text: '+3 Evidence. Raises Global Gaze by 1 automatically.',
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
        text: 'Gain +1 Body in Cairo.',
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
        text: 'Gain 1 body in Alexandria. Advance Patriarchal Grip.',
        domainBonus: 'PatriarchalGrip',
        effects: [
            { type: 'modify_domain', domain: 'PatriarchalGrip', delta: 1 },
            { type: 'add_bodies', region: 'Alexandria', seat: 'acting_player', amount: 1 }
        ]
    }
];
