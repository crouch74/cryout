import type { CrisisCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const crisisCards: CrisisCardDefinition[] = [
    {
        id: 'crisis_tahrir_central_security',
        deck: 'crisis',
        name: 'Central Security Forces',
        text: 'The System moves first and forces a hard turn across Cairo. Military intervention adds 1 Extraction to Cairo immediately. The coalition must absorb this pressure and reorganize before the next phase.',
        effects: [
            { type: 'add_extraction', region: 'Cairo', amount: 0 },
        ],
    },
    {
        id: 'crisis_tahrir_internet_shutdown',
        deck: 'crisis',
        name: 'Internet Shutdown',
        text: 'The System moves first and forces a hard turn through communications control. All players lose 1 Evidence, representing a one-round Digital Front shutdown. The coalition must absorb this pressure and reorganize before the next phase.',
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
        text: 'The System moves first and forces a hard turn with organized street violence in Tahrir. Remove 2 Comrades from Cairo and raise Global Gaze by 2 through global outrage. The coalition must absorb this pressure and reorganize before the next phase.',
        effects: [
            { type: 'remove_comrades', region: 'Cairo', seat: 0, amount: 1 },
            { type: 'remove_comrades', region: 'Cairo', seat: 1, amount: 1 },
            { type: 'modify_gaze', delta: 2 },
        ],
    },
    {
        id: 'crisis_tahrir_state_tv_lies',
        deck: 'crisis',
        name: 'State TV Lies',
        text: 'The System moves first and forces a hard turn with coordinated propaganda. Regime disinformation reduces Global Gaze by 2. The coalition must absorb this pressure and reorganize before the next phase.',
        effects: [
            { type: 'modify_gaze', delta: -2 },
        ],
    },
    {
        id: 'crisis_tahrir_military_trials',
        deck: 'crisis',
        name: 'Military Trials',
        text: 'The System moves first and forces a hard turn through military trials. Remove 1 Comrade from Cairo and add 1 Evidence as testimony circulates in response. The coalition must absorb this pressure and reorganize before the next phase.',
        effects: [
            { type: 'remove_comrades', region: 'Cairo', seat: 0, amount: 1 },
            { type: 'gain_evidence', seat: 0, amount: 1 },
        ],
    },
    {
        id: 'crisis_tahrir_constitutional_declaration',
        deck: 'crisis',
        name: 'Constitutional Declaration',
        text: 'The System moves first and forces a hard turn through constitutional overreach. Add 1 to Unfinished Justice. The coalition must absorb this pressure and reorganize before the next phase.',
        effects: [
            { type: 'modify_domain', domain: 'UnfinishedJustice', delta: 1 },
        ],
    },
    {
        id: 'crisis_tahrir_rabaa_massacre',
        deck: 'crisis',
        name: 'Rabaa Massacre',
        text: 'The System moves first and forces a hard turn with a mass crackdown. Gain a permanent +2 Global Gaze as the brutality is witnessed internationally. The coalition must absorb this pressure and reorganize before the next phase.',
        effects: [
            { type: 'modify_gaze', delta: 2 },
            { type: 'add_extraction', region: 'Cairo', amount: 0 },
        ],
    },
];
