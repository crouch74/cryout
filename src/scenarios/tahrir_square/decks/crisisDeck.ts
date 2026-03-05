import type { CrisisCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const crisisCards: CrisisCardDefinition[] = [
    {
        id: 'crisis_tahrir_central_security',
        deck: 'crisis',
        name: 'Central Security Forces',
        text: 'Military intervention in Cairo. Add 2 Extraction to Cairo.',
        effects: [
            { type: 'add_extraction', region: 'Cairo', amount: 2 },
        ],
    },
    {
        id: 'crisis_tahrir_internet_shutdown',
        deck: 'crisis',
        name: 'Internet Shutdown',
        text: 'All players lose 1 Evidence. No Digital Front actions for 1 round (Simulated by Evidence loss).',
        effects: [
            { type: 'lose_evidence', seat: 0, amount: 1 },
            { type: 'lose_evidence', seat: 1, amount: 1 },
            { type: 'lose_evidence', seat: 2, amount: 1 },
            { type: 'lose_evidence', seat: 3, amount: 1 },
        ],
    },
    {
        id: 'crisis_tahrir_camel_battle',
        deck: 'crisis',
        name: 'Camel Battle',
        text: 'Regime thugs attack Tahrir on horses. Remove 3 Comrades from Cairo. Gain +2 Global Gaze (outrage).',
        effects: [
            { type: 'remove_comrades', region: 'Cairo', seat: 0, amount: 1 },
            { type: 'remove_comrades', region: 'Cairo', seat: 1, amount: 1 },
            { type: 'remove_comrades', region: 'Cairo', seat: 2, amount: 1 },
            { type: 'modify_gaze', delta: 2 },
        ],
    },
    {
        id: 'crisis_tahrir_state_tv_lies',
        deck: 'crisis',
        name: 'State TV Lies',
        text: 'Regime claims protests are foreign agents. Reduce Global Gaze by 2.',
        effects: [
            { type: 'modify_gaze', delta: -2 },
        ],
    },
    {
        id: 'crisis_tahrir_military_trials',
        deck: 'crisis',
        name: 'Military Trials',
        text: 'Remove 1 Comrade from Cairo (civilian tried). Add 1 Evidence (outrage).',
        effects: [
            { type: 'remove_comrades', region: 'Cairo', seat: 0, amount: 1 },
            { type: 'gain_evidence', seat: 0, amount: 1 },
        ],
    },
    {
        id: 'crisis_tahrir_constitutional_declaration',
        deck: 'crisis',
        name: 'Constitutional Declaration',
        text: 'Morsi grants himself unlimited power. Add 1 to Unfinished Justice.',
        effects: [
            { type: 'modify_domain', domain: 'UnfinishedJustice', delta: 1 },
        ],
    },
    {
        id: 'crisis_tahrir_rabaa_massacre',
        deck: 'crisis',
        name: 'Rabaa Massacre',
        text: 'A brutal crackdown. Gain permanent +2 Global Gaze (horror).',
        effects: [
            { type: 'modify_gaze', delta: 2 },
            { type: 'add_extraction', region: 'Cairo', amount: 3 },
        ],
    },
];
