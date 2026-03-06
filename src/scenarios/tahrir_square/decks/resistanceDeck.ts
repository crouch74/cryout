import type { ResistanceCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const resistanceCards: ResistanceCardDefinition[] = [
    {
        id: 'res_tahrir_cell_phone_video',
        deck: 'resistance',
        type: 'support',
        name: 'Cell Phone Video',
        text: 'The movement creates a brief opening through collective action and media coordination. The acting faction gains 2 Evidence, usable on Silenced Truth campaigns or to Go Viral. Use this shift quickly before the System closes ranks again.',
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
        text: 'The movement creates a brief opening through collective action. Acting faction gains 3 Evidence and raises Global Gaze by 1. Use this shift quickly before the System closes ranks again.',
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
        text: 'The movement creates a brief opening through collective action. Add 1 Comrade to Cairo for the acting faction. Use this shift quickly before the System closes ranks again.',
        regionBonus: 'Cairo',
        effects: [
            { type: 'add_comrades', region: 'Cairo', seat: 'acting_player', amount: 1 }
        ]
    },
    {
        id: 'res_tahrir_lawyer_brief',
        deck: 'resistance',
        type: 'action',
        name: 'Lawyer\'s Legal Brief',
        text: 'The movement creates a brief opening through collective action. Add 1 Comrade to Alexandria for the acting faction and advance Patriarchal Grip by 1. Use this shift quickly before the System closes ranks again.',
        domainBonus: 'PatriarchalGrip',
        effects: [
            { type: 'modify_domain', domain: 'PatriarchalGrip', delta: 1 },
            { type: 'add_comrades', region: 'Alexandria', seat: 'acting_player', amount: 1 }
        ]
    }
];
