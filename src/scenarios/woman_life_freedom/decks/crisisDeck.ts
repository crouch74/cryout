import type { CrisisCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const crisisCards: CrisisCardDefinition[] = [
    {
        id: 'crisis_wlf_morality_police_raid',
        deck: 'crisis',
        name: 'Morality Police Raid',
        text: 'The System moves first and forces a hard turn in Tehran. Remove 1 Comrade and add 1 Extraction to Tehran as patrol violence expands control. The coalition must absorb this pressure and reorganize before the next phase.',
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
        text: 'The System moves first and forces a hard turn by severing communications. All players lose 1 Evidence and Global Gaze drops by 1. The coalition must absorb this pressure and reorganize before the next phase.',
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
        text: 'The System moves first and forces a hard turn through retaliatory repression. Remove 1 Comrade from Kurdistan and Isfahan, then increase War Machine by 1. The coalition must absorb this pressure and reorganize before the next phase.',
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
        text: 'The System moves first and forces a hard turn through public terror. Patriarchal Grip increases by 1 and Global Gaze increases by 1 as the violence becomes impossible to ignore. The coalition must absorb this pressure and reorganize before the next phase.',
        effects: [
            { type: 'modify_gaze', delta: 1 },
            { type: 'modify_domain', domain: 'PatriarchalGrip', delta: 1 },
        ],
    },
    {
        id: 'crisis_wlf_irgc_deployment',
        deck: 'crisis',
        name: 'IRGC Deployment',
        text: 'The System moves first and forces a hard turn with direct Guard deployment. Add 2 Extraction across Kurdistan and Balochistan. The coalition must absorb this pressure and reorganize before the next phase.',
        effects: [
            { type: 'add_extraction', region: 'Kurdistan', amount: 2 },
            { type: 'add_extraction', region: 'Balochistan', amount: 2 },
        ],
    }
];
