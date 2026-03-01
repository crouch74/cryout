// ============================================================
// Card Content — "Where the Stones Cry Out"
// All card decks: Resistance (20), Evidence (20), Crisis (20)
// ============================================================

import type { Card } from './types';

// ============================================================
// RESISTANCE CARDS (Red Back)
// ============================================================
export function createResistanceDeck(): Card[] {
    return shuffleArray([
        {
            id: 'res_01', name: 'Underground Railroad', deck: 'resistance' as const, type: 'permanent' as const,
            effect: 'Once per round, when you Smuggle Evidence, move 2 additional Evidence cards at no Body cost.',
            flavorText: 'The tunnels are old. The maps are older. The will is new.',
        },
        {
            id: 'res_02', name: 'Journalist Ally', deck: 'resistance' as const, type: 'permanent' as const,
            effect: 'When you Investigate, draw 3 Evidence cards and keep 2 instead of drawing 2 and keeping 1.',
            flavorText: 'She carries a camera and a death wish. The world needs both.',
        },
        {
            id: 'res_03', name: 'General Strike', deck: 'resistance' as const, type: 'action' as const,
            region: 'any' as const,
            effect: 'Choose a region. Remove 1 Extraction Token. Lose 3 Bodies.',
            flavorText: 'The machines stopped. The silence was louder than any protest.',
        },
        {
            id: 'res_04', name: 'International Tribunal', deck: 'resistance' as const, type: 'action' as const,
            effect: 'Raise Global Gaze by 2. The Northern War Machine decreases by 1.',
            flavorText: 'The judges sat. The evidence spoke. The powerful squirmed.',
        },
        {
            id: 'res_05', name: 'Diaspora Network', deck: 'resistance' as const, type: 'permanent' as const,
            effect: 'International Outreach costs 1 Evidence card instead of 2.',
            flavorText: 'They left home but home never left them. Every phone call is resistance.',
        },
        {
            id: 'res_06', name: 'Solidarity March', deck: 'resistance' as const, type: 'instant' as const,
            effect: 'When another player loses Bodies, you may give them up to 3 of your own Bodies.',
            flavorText: 'We walked until our feet bled. Then we walked some more.',
        },
        {
            id: 'res_07', name: 'Encrypted Communications', deck: 'resistance' as const, type: 'permanent' as const,
            effect: 'Smuggle Evidence costs no Bodies.',
            flavorText: 'The messages travel through fiber optic and whisper. Both are unbreakable.',
        },
        {
            id: 'res_08', name: 'Community Kitchen', deck: 'resistance' as const, type: 'action' as const,
            region: 'any' as const,
            effect: 'Choose a region. Gain 4 Bodies in that region.',
            flavorText: 'The revolution runs on bread and olive oil.',
        },
        {
            id: 'res_09', name: 'Legal Defense Fund', deck: 'resistance' as const, type: 'instant' as const,
            effect: 'Cancel the effect of one Crisis card that removes Bodies. Discard this card.',
            flavorText: 'The lawyers arrived before the bulldozers. This time.',
        },
        {
            id: 'res_10', name: 'Whistle-blower', deck: 'resistance' as const, type: 'action' as const,
            effect: 'Draw 3 Evidence cards. Keep all of them. Raise Global Gaze by 1.',
            flavorText: 'She copied the files at 3 AM. By dawn, the world knew.',
        },
        {
            id: 'res_11', name: 'Youth Movement', deck: 'resistance' as const, type: 'permanent' as const,
            effect: 'Organize actions gain +1 Body.',
            flavorText: 'They are fifteen. They have seen more than most. They are not afraid.',
        },
        {
            id: 'res_12', name: 'Ancestral Knowledge', deck: 'resistance' as const, type: 'action' as const,
            effect: 'Advance Dying Planet and Stolen Voice domains by 1 each. No cost.',
            flavorText: 'The elders remember when the river was clean. They will teach the children.',
        },
        {
            id: 'res_13', name: 'Sabotage', deck: 'resistance' as const, type: 'action' as const,
            region: 'any' as const,
            effect: 'Choose a region. Roll 1d6. On 4+, remove 1 Extraction Token. On 1-3, lose 2 Bodies.',
            flavorText: 'The pipeline leaked. Was it rust or resistance? Does it matter?',
        },
        {
            id: 'res_14', name: 'Medical Aid', deck: 'resistance' as const, type: 'instant' as const,
            effect: 'After a military intervention, recover half the Bodies lost (round up).',
            flavorText: 'The doctors work in bombed hospitals. The medicine is hope.',
        },
        {
            id: 'res_15', name: 'Cultural Festival', deck: 'resistance' as const, type: 'action' as const,
            region: 'any' as const,
            effect: 'Choose a region. Gain 3 Bodies AND advance Stolen Voice by 1.',
            flavorText: 'They danced. In the ruins, they danced. The soldiers did not understand.',
        },
        {
            id: 'res_16', name: 'Prisoner Exchange', deck: 'resistance' as const, type: 'action' as const,
            effect: 'Advance Gilded Cage by 1. Gain 2 Bodies. Raise Global Gaze by 1.',
            flavorText: 'The cell doors opened. Fifteen years of darkness ended with sunlight.',
        },
        {
            id: 'res_17', name: 'Blockade', deck: 'resistance' as const, type: 'action' as const,
            region: 'any' as const,
            effect: 'Choose a region. That region cannot receive Extraction Tokens next round.',
            flavorText: 'The road is blocked. The trucks wait. The people sing.',
        },
        {
            id: 'res_18', name: 'Leaked Memo', deck: 'resistance' as const, type: 'instant' as const,
            effect: 'Look at the top 3 Crisis cards. Rearrange them in any order.',
            flavorText: 'The document was classified. Now it is evidence.',
        },
        {
            id: 'res_19', name: 'Mutual Aid Network', deck: 'resistance' as const, type: 'permanent' as const,
            effect: 'At the end of each round, any player may give you 1 Body freely.',
            flavorText: 'We have nothing but each other. That is enough.',
        },
        {
            id: 'res_20', name: 'Documentary Film', deck: 'resistance' as const, type: 'action' as const,
            effect: 'Raise Global Gaze by 3. Draw 1 Crisis card (attention brings backlash).',
            flavorText: 'The camera never blinks. The world sees. What will they do?',
        },
    ]);
}

// ============================================================
// EVIDENCE CARDS (Blue Back)
// ============================================================
export function createEvidenceDeck(): Card[] {
    return shuffleArray([
        {
            id: 'evi_01', name: 'Drone Footage of Massacre', deck: 'evidence' as const, type: 'instant' as const,
            region: 'any' as const, campaignBonus: 2, domainBonus: 'War Machine' as const,
            effect: '+2 to any Launch Campaign in the War Machine domain. May discard to raise Global Gaze by 1.',
            flavorText: 'The world saw. The world looked away. Show them again.',
        },
        {
            id: 'evi_02', name: 'Leaked Mining Contract', deck: 'evidence' as const, type: 'instant' as const,
            region: 'any' as const, campaignBonus: 1,
            effect: '+1 to any Launch Campaign. Reveals corporate complicity.',
            flavorText: 'Page 47, Clause 12: "The company shall not be held liable for displacement."',
        },
        {
            id: 'evi_03', name: 'Water Quality Report', deck: 'evidence' as const, type: 'instant' as const,
            region: 'any' as const, campaignBonus: 2, domainBonus: 'Dying Planet' as const,
            effect: '+2 to any Launch Campaign in the Dying Planet domain.',
            flavorText: 'Arsenic: 300% above safe limit. Mercury: detected. Hope: not detected.',
        },
        {
            id: 'evi_04', name: 'Prisoner Testimony', deck: 'evidence' as const, type: 'instant' as const,
            region: 'any' as const, campaignBonus: 2, domainBonus: 'Gilded Cage' as const,
            effect: '+2 to any Launch Campaign in the Gilded Cage domain.',
            flavorText: 'I was held for 847 days without charge. This is my voice.',
        },
        {
            id: 'evi_05', name: 'Satellite Imagery', deck: 'evidence' as const, type: 'instant' as const,
            region: 'any' as const, campaignBonus: 1,
            effect: '+1 to any Launch Campaign. Evidence from above.',
            flavorText: 'The before photo shows forest. The after photo shows nothing.',
        },
        {
            id: 'evi_06', name: 'NGO Report', deck: 'evidence' as const, type: 'instant' as const,
            region: 'any' as const, campaignBonus: 1,
            effect: '+1 to any Launch Campaign. Raise Global Gaze by 1 on success.',
            flavorText: 'Pages 1-200: Evidence. Pages 201-400: More evidence. Appendix: List of the dead.',
        },
        {
            id: 'evi_07', name: 'Arms Shipment Manifest', deck: 'evidence' as const, type: 'instant' as const,
            region: 'any' as const, campaignBonus: 2, domainBonus: 'War Machine' as const,
            effect: '+2 to any Campaign against War Machine. Lower Northern War Machine by 1 on success.',
            flavorText: 'Container 47B: 500 rifles. Destination: classified. Use: obvious.',
        },
        {
            id: 'evi_08', name: 'Censored Broadcast', deck: 'evidence' as const, type: 'instant' as const,
            region: 'any' as const, campaignBonus: 2, domainBonus: 'Silenced Truth' as const,
            effect: '+2 to any Campaign in the Silenced Truth domain.',
            flavorText: 'The broadcast lasted 47 seconds before the signal was cut. It was enough.',
        },
        {
            id: 'evi_09', name: 'Financial Records', deck: 'evidence' as const, type: 'instant' as const,
            region: 'any' as const, campaignBonus: 1,
            effect: '+1 to any Launch Campaign. Follow the money.',
            flavorText: 'Account BH-4432: Transfer $12M USD to "Security Consultants Inc." Subject: Pacification.',
        },
        {
            id: 'evi_10', name: 'Indigenous Land Map', deck: 'evidence' as const, type: 'instant' as const,
            region: 'any' as const, campaignBonus: 2, domainBonus: 'Stolen Voice' as const,
            effect: '+2 to any Campaign in the Stolen Voice domain.',
            flavorText: 'This map is older than their country. The boundaries are drawn in memory.',
        },
        {
            id: 'evi_11', name: 'Debt Trap Documents', deck: 'evidence' as const, type: 'instant' as const,
            region: 'The Mekong' as const, campaignBonus: 2, domainBonus: 'Fossil Grip' as const,
            effect: '+2 to any Campaign in The Mekong or Fossil Grip domain.',
            flavorText: 'Interest rate: 12%. Collateral: sovereignty. Default clause: surrender.',
        },
        {
            id: 'evi_12', name: 'Medical Records', deck: 'evidence' as const, type: 'instant' as const,
            region: 'any' as const, campaignBonus: 1,
            effect: '+1 to any Campaign. Evidence of harm.',
            flavorText: 'Patient 1: Chemical burns. Patient 2: Malnutrition. Patient 3: Bullet wound. Patient 4-40: Same.',
        },
        {
            id: 'evi_13', name: 'Fossil Fuel Subsidy Data', deck: 'evidence' as const, type: 'instant' as const,
            region: 'any' as const, campaignBonus: 2, domainBonus: 'Fossil Grip' as const,
            effect: '+2 to any Campaign in the Fossil Grip domain.',
            flavorText: '$5.2 trillion in subsidies. Per year. For burning the planet.',
        },
        {
            id: 'evi_14', name: 'Whistleblower Recording', deck: 'evidence' as const, type: 'instant' as const,
            region: 'any' as const, campaignBonus: 2,
            effect: '+2 to any Launch Campaign. High-value intelligence.',
            flavorText: 'Recording timestamp: 02:47 AM. "Make sure the villagers are gone before dawn."',
        },
        {
            id: 'evi_15', name: 'Supply Chain Audit', deck: 'evidence' as const, type: 'instant' as const,
            region: 'any' as const, campaignBonus: 1, domainBonus: 'Empty Stomach' as const,
            effect: '+1 to any Campaign. +2 if targeting Empty Stomach domain.',
            flavorText: 'Your phone contains the fingerprints of a child who will never go to school.',
        },
        {
            id: 'evi_16', name: 'Embassy Cable', deck: 'evidence' as const, type: 'instant' as const,
            region: 'any' as const, campaignBonus: 1,
            effect: '+1 to any Campaign. Diplomatic evidence.',
            flavorText: 'CONFIDENTIAL: "Regime stability takes priority over civilian casualties." — Ambassador.',
        },
        {
            id: 'evi_17', name: 'Environmental Impact Study', deck: 'evidence' as const, type: 'instant' as const,
            region: 'any' as const, campaignBonus: 1, domainBonus: 'Dying Planet' as const,
            effect: '+1 to any Campaign. +2 if targeting Dying Planet domain.',
            flavorText: 'Species extinct: 14. Hectares burned: 200,000. Profit margin: excellent.',
        },
        {
            id: 'evi_18', name: 'Refugee Testimony', deck: 'evidence' as const, type: 'instant' as const,
            region: 'any' as const, campaignBonus: 1,
            effect: '+1 to any Campaign. Human evidence.',
            flavorText: 'We walked for seven days. My daughter was born on day three. We named her Hope.',
        },
        {
            id: 'evi_19', name: 'Surveillance Logs', deck: 'evidence' as const, type: 'instant' as const,
            region: 'any' as const, campaignBonus: 1,
            effect: '+1 to any Campaign. Turn their tools against them.',
            flavorText: 'They watched us. Now we have their records. Every camera has a blind spot.',
        },
        {
            id: 'evi_20', name: 'UN Resolution Draft', deck: 'evidence' as const, type: 'instant' as const,
            region: 'any' as const, campaignBonus: 1,
            effect: '+1 to any Campaign. Raise Global Gaze by 1.',
            flavorText: 'Resolution 2847: "Deeply concerned." Translation: Still waiting.',
        },
    ]);
}

// ============================================================
// CRISIS CARDS (Black Back)
// ============================================================
export function createCrisisDeck(): Card[] {
    return shuffleArray([
        {
            id: 'cri_01', name: 'Land Confiscation Order', deck: 'crisis' as const, type: 'instant' as const,
            region: 'The Levant' as const, bodiesLost: 2, tokensAdded: 1,
            effect: 'Remove 2 Bodies from The Levant. If no Bodies present, add 1 Extraction Token.',
            flavorText: 'The bulldozers came at dawn. They had court orders. The courts are in Tel Aviv.',
        },
        {
            id: 'cri_02', name: 'IMF Structural Adjustment', deck: 'crisis' as const, type: 'instant' as const,
            region: 'any' as const, bodiesLost: 2, tokensAdded: 1,
            effect: 'Roll for random region. Remove 2 Bodies. If no Bodies, add 1 Extraction Token.',
            flavorText: 'Loan conditions: Cut health spending. Open mining sector. The doctors strike. The miners arrive.',
        },
        {
            id: 'cri_03', name: 'Drone Strike', deck: 'crisis' as const, type: 'instant' as const,
            region: 'any' as const, bodiesLost: 3, tokensAdded: 0,
            effect: 'Roll for random region. Remove 3 Bodies from that region.',
            flavorText: 'Target neutralized. Collateral damage: 14 civilians. Incident report: classified.',
        },
        {
            id: 'cri_04', name: 'Media Blackout', deck: 'crisis' as const, type: 'instant' as const,
            bodiesLost: 0, tokensAdded: 0,
            effect: 'Lower Global Gaze by 2. All players discard 1 Evidence card.',
            flavorText: 'The internet was cut. The phone lines went dead. In the silence, they moved.',
        },
        {
            id: 'cri_05', name: 'Proxy Militia Attack', deck: 'crisis' as const, type: 'instant' as const,
            region: 'Congo Basin' as const, bodiesLost: 3, tokensAdded: 1,
            effect: 'Remove 3 Bodies from Congo Basin. If Bodies remain, add 1 Extraction Token.',
            flavorText: 'M23 crossed the border at midnight. Rwanda denies everything. The mines keep running.',
        },
        {
            id: 'cri_06', name: 'Dam Construction', deck: 'crisis' as const, type: 'instant' as const,
            region: 'The Mekong' as const, bodiesLost: 1, tokensAdded: 1,
            effect: 'Add 1 Extraction Token to The Mekong. Remove 1 Body (displaced villagers).',
            flavorText: 'The river that fed millions is now a reservoir. Progress, they call it.',
        },
        {
            id: 'cri_07', name: 'Activist Assassination', deck: 'crisis' as const, type: 'instant' as const,
            region: 'The Amazon' as const, bodiesLost: 2, tokensAdded: 0,
            effect: 'Remove 2 Bodies from The Amazon. Lower Global Gaze by 1.',
            flavorText: 'She was shot on her doorstep. The police investigation found nothing. They always find nothing.',
        },
        {
            id: 'cri_08', name: 'Sanctions Relief', deck: 'crisis' as const, type: 'instant' as const,
            bodiesLost: 0, tokensAdded: 1,
            effect: 'Increase Northern War Machine by 1. Add 1 Extraction Token to region with fewest tokens.',
            flavorText: 'The sanctions were lifted. Arms flow freely again. Peace is expensive; war is profitable.',
        },
        {
            id: 'cri_09', name: 'Forced Displacement', deck: 'crisis' as const, type: 'instant' as const,
            region: 'any' as const, bodiesLost: 2, tokensAdded: 0,
            effect: 'Roll for random region. Move 2 Bodies from that region to an adjacent one (player choice). If none, lose them.',
            flavorText: 'Pack one bag. You have thirty minutes. Leave the keys.',
        },
        {
            id: 'cri_10', name: 'Greenwashing Campaign', deck: 'crisis' as const, type: 'instant' as const,
            bodiesLost: 0, tokensAdded: 0,
            effect: 'Lower Global Gaze by 3. "Sustainable extraction" — the world believes it.',
            flavorText: '"Net-zero by 2050" — Printed on recycled paper. Signed in oil.',
        },
        {
            id: 'cri_11', name: 'Debt Crisis', deck: 'crisis' as const, type: 'instant' as const,
            region: 'The Andes' as const, bodiesLost: 2, tokensAdded: 1,
            effect: 'Remove 2 Bodies from The Andes. Add 1 Extraction Token (privatization fire sale).',
            flavorText: 'The interest payments exceed the health budget. The lithium must flow.',
        },
        {
            id: 'cri_12', name: 'Military Coup', deck: 'crisis' as const, type: 'instant' as const,
            region: 'The Sahel' as const, bodiesLost: 3, tokensAdded: 1,
            effect: 'Remove 3 Bodies from The Sahel. Add 1 Extraction Token. Increase War Machine by 1.',
            flavorText: 'The general appeared on television at 6 AM. By noon, the constitution was suspended.',
        },
        {
            id: 'cri_13', name: 'Trade Agreement', deck: 'crisis' as const, type: 'instant' as const,
            bodiesLost: 0, tokensAdded: 1,
            effect: 'Add 1 Extraction Token to 2 different regions (roll randomly). "Free trade" arrives.',
            flavorText: 'Chapter 9: Investor-State Dispute Settlement. Translation: Corporations can sue countries.',
        },
        {
            id: 'cri_14', name: 'Climate Disaster', deck: 'crisis' as const, type: 'instant' as const,
            region: 'any' as const, bodiesLost: 2, tokensAdded: 0,
            effect: 'Remove 2 Bodies from each of 2 random regions. The planet fights back.',
            flavorText: 'Flood. Drought. Fire. Flood again. The cycle accelerates.',
        },
        {
            id: 'cri_15', name: 'Surveillance Expansion', deck: 'crisis' as const, type: 'instant' as const,
            bodiesLost: 0, tokensAdded: 0,
            effect: 'All players discard 2 Evidence cards. Investigation actions cost 1 Body next round.',
            flavorText: 'Pegasus. Predator. New names for old tools. Your phone is their window.',
        },
        {
            id: 'cri_16', name: 'Settlement Expansion', deck: 'crisis' as const, type: 'instant' as const,
            region: 'The Levant' as const, bodiesLost: 1, tokensAdded: 1,
            effect: 'Add 1 Extraction Token to The Levant. Remove 1 Body. Lower Global Gaze by 1.',
            flavorText: 'Another hilltop. Another outpost. Another family with nowhere to go.',
        },
        {
            id: 'cri_17', name: 'Corporate Lawsuit', deck: 'crisis' as const, type: 'instant' as const,
            bodiesLost: 0, tokensAdded: 0,
            effect: 'One player (lowest Bodies) must discard all Evidence cards. The corporation sues for defamation.',
            flavorText: 'The corporation sues for $50 million in damages. The village has $50.',
        },
        {
            id: 'cri_18', name: 'Arms Deal', deck: 'crisis' as const, type: 'instant' as const,
            bodiesLost: 0, tokensAdded: 0,
            effect: 'Increase Northern War Machine by 2.',
            flavorText: '$38 billion. The largest arms package in history. "Defensive," they insist.',
        },
        {
            id: 'cri_19', name: 'Pandemic Wave', deck: 'crisis' as const, type: 'instant' as const,
            bodiesLost: 2, tokensAdded: 0,
            effect: 'Remove 1 Body from every region that has Bodies. Organize actions gain -1 Body next round.',
            flavorText: 'Vaccines for the North. Prayers for the South. The virus does not discriminate; the world does.',
        },
        {
            id: 'cri_20', name: 'Resource Nationalism Crackdown', deck: 'crisis' as const, type: 'instant' as const,
            region: 'any' as const, bodiesLost: 2, tokensAdded: 1,
            effect: 'Roll for random region. Remove 2 Bodies and add 1 Extraction Token.',
            flavorText: 'The government said: "These resources belong to the people." Then sold them to the corporation.',
        },
    ]);
}

// ============================================================
// BEACON CARDS (Gold Back — Mode B)
// ============================================================
export function createBeaconDeck(): Card[] {
    return [
        {
            id: 'bea_01', name: 'Free All Political Prisoners', deck: 'beacon' as const, type: 'permanent' as const,
            effect: 'Win three separate Gilded Cage campaigns in any combination of regions.',
            flavorText: 'The cells are empty. The prisoners are home. The jailers are silent.',
        },
        {
            id: 'bea_02', name: 'River of Return', deck: 'beacon' as const, type: 'permanent' as const,
            effect: 'Reduce The Mekong to 0 Extraction Tokens while Dying Planet track is at 7+.',
            flavorText: 'The dam broke. Not from force — from patience. The river remembered its course.',
        },
        {
            id: 'bea_03', name: 'The Olive Harvest', deck: 'beacon' as const, type: 'permanent' as const,
            effect: 'Reduce The Levant to 1 or fewer Extraction Tokens while any player has 10+ Bodies.',
            flavorText: 'This year, they harvested in peace. The trees are older than the occupation.',
        },
    ];
}

// ============================================================
// Utility
// ============================================================
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export { shuffleArray };
