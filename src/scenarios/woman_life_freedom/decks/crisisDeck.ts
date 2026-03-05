import type { CrisisCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const crisisCards: CrisisCardDefinition[] = [
    {
        id: 'crisis_wlf_morality_police_raid',
        deck: 'crisis',
        name: 'Morality Police Raid',
        text: 'A patrol hits Tehran. Remove 1 Comrade and add 1 Extraction to Tehran.',
        effects: [
            { type: 'remove_comrades', region: 'Tehran', seat: 0, amount: 1 },
            { type: 'remove_comrades', region: 'Tehran', seat: 1, amount: 1 },
            { type: 'add_extraction', region: 'Tehran', amount: 1 },
        ],
    },
    {
        id: 'crisis_wlf_internet_blackout',
        deck: 'crisis',
        name: 'Internet Blackout',
        text: 'The state cuts access. All players lose 1 Evidence. Global Gaze drops by 1.',
        effects: [
            { type: 'lose_evidence', seat: 0, amount: 1 },
            { type: 'lose_evidence', seat: 1, amount: 1 },
            { type: 'lose_evidence', seat: 2, amount: 1 },
            { type: 'modify_gaze', delta: -1 },
        ],
    },
    {
        id: 'crisis_wlf_gas_attacks_on_schools',
        deck: 'crisis',
        name: 'Gas Attacks on Schools',
        text: 'Retaliation against schoolgirls. Remove 1 Comrade from Kurdistan and Isfahan. War Machine increases by 1.',
        effects: [
            { type: 'remove_comrades', region: 'Kurdistan', seat: 0, amount: 1 },
            { type: 'remove_comrades', region: 'Isfahan', seat: 0, amount: 1 },
            { type: 'modify_war_machine', delta: 1 },
        ],
    },
    {
        id: 'crisis_wlf_sham_trials_and_executions',
        deck: 'crisis',
        name: 'Sham Trials and Executions',
        text: 'Protesters are hanged to instill fear. Oppression solidifies. Patriarchal Grip +1, Global Gaze +1.',
        effects: [
            { type: 'modify_gaze', delta: 1 },
            { type: 'modify_domain', domain: 'PatriarchalGrip', delta: 1 },
        ],
    },
    {
        id: 'crisis_wlf_irgc_deployment',
        deck: 'crisis',
        name: 'IRGC Deployment',
        text: 'The Revolutionary Guard steps in. Add 2 Extraction to Kurdistan and Balochistan.',
        effects: [
            { type: 'add_extraction', region: 'Kurdistan', amount: 2 },
            { type: 'add_extraction', region: 'Balochistan', amount: 2 },
        ],
    }
];
