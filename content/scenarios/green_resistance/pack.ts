import type { PackDefinition } from '../../../engine/types.ts';

const pack: PackDefinition = {
  id: 'green_resistance',
  type: 'scenario',
  version: '1.0.0',
  dependsOn: ['base'],
  scenario: {
    id: 'green_resistance',
    name: 'Green Resistance',
    description:
      'Forest communities face a coordinated extraction surge where climate, energy, and rights pressure reinforce each other.',
    introduction:
      'The coalition shifts toward land defenders, river communities, and movement journalists trying to hold the line across Congo, Sudan, the Sahel, and the wider climate frontier.',
    story:
      'Green Resistance frames frontline environmental defense as a struggle over memory, sovereignty, and survival. Concessions, private security, and disinformation campaigns clear the way for extraction while local communities fight to keep forests, rivers, and energy futures from becoming sacrifice zones.',
    dramatization:
      'This scenario should feel slower, wetter, and more territorial than Witness & Dignity. One turn is a blockade on a logging road, the next a testimony circuit, the next a jury-rigged microgrid keeping a village clinic alive while the smoke closes in.',
    gameplay:
      'Green Resistance begins with more grassroots capacity than the Palestine scenario, but the coalition is spread across more regions and starts with tighter civic space. The challenge is preventing climate and energy escalation from creating a rolling displacement crisis while still investing in culture, legal protection, and long-term infrastructure.',
    mechanics:
      'Root Solidarity turns cultural protection into momentum by generating solidarity at the start of a round once Art & Culture is stabilized. Extraction Spiral punishes ignored climate pressure by pushing fresh displacement into Congo and Sudan before the world phase resolves. The scenario rewards distributed institution-building and punishes leaving ecological fronts to drift.',
    moralCenter:
      'Indigenous land defenders and forest communities are treated as protagonists with agency, not background scenery for a climate disaster story.',
    setup: {
      civicSpace: 'REPRESSED',
      temperature: 3,
      resources: {
        solidarity: 4,
        evidence: 1,
        capacity: 2,
        relief: 0,
      },
      frontOverrides: {
        WAR: { pressure: 2, protection: 4, impact: 2 },
        CLIMATE: { pressure: 6, protection: 2, impact: 4 },
        RIGHTS: { pressure: 5, protection: 2, impact: 3 },
        SPEECH_INFO: { pressure: 5, protection: 3, impact: 3 },
        POVERTY: { pressure: 4, protection: 3, impact: 2 },
        ENERGY: { pressure: 5, protection: 2, impact: 4 },
        CULTURE: { pressure: 3, protection: 4, impact: 2 },
      },
      regionOverrides: {
        Congo: {
          tokens: { displacement: 1, disinfo: 0, compromise_debt: 0 },
          locks: [],
          vulnerability: { CLIMATE: 3, POVERTY: 2, ENERGY: 2, RIGHTS: 1 },
        },
        Sudan: {
          tokens: { displacement: 0, disinfo: 1, compromise_debt: 0 },
          locks: [],
          vulnerability: { CLIMATE: 2, SPEECH_INFO: 3, RIGHTS: 2, CULTURE: 1 },
        },
        Sahel: {
          vulnerability: { CLIMATE: 2, ENERGY: 2, POVERTY: 2 },
        },
        Yemen: {
          vulnerability: { CLIMATE: 3, ENERGY: 2 },
        },
      },
    },
    specialRuleChips: [
      {
        id: 'root_solidarity',
        label: 'Root Solidarity',
        description: 'At the start of a round, if Art & Culture protection is 5+, gain 1 solidarity.',
        flagKey: 'root_solidarity_online',
      },
      {
        id: 'extraction_spiral',
        label: 'Extraction Spiral',
        description:
          'When Climate pressure reaches 7 or more, Congo and Sudan each gain 1 displacement during the world phase.',
      },
    ],
    roundLimit: {
      CORE: 8,
      FULL: 12,
    },
    hooks: [
      {
        id: 'root_solidarity_round_start',
        hook: 'on_round_start',
        when: {
          kind: 'compare',
          left: { type: 'front_stat', front: 'CULTURE', stat: 'protection' },
          op: '>=',
          right: 5,
        },
        emoji: '🌿',
        message: 'Root Solidarity feeds the coalition.',
        effects: [
          { type: 'set_flag', scope: 'round', key: 'root_solidarity_online', value: true },
          { type: 'gain_resource', resource: 'solidarity', amount: 1 },
        ],
      },
      {
        id: 'extraction_spiral_trigger',
        hook: 'on_world_phase_pre',
        when: {
          kind: 'compare',
          left: { type: 'front_stat', front: 'CLIMATE', stat: 'pressure' },
          op: '>=',
          right: 7,
        },
        emoji: '🪓',
        message: 'Extraction Spiral drives new displacement across forest regions.',
        effects: [
          { type: 'add_token', region: 'Congo', token: 'displacement', count: 1 },
          { type: 'add_token', region: 'Sudan', token: 'displacement', count: 1 },
        ],
      },
    ],
  },
};

export default pack;
