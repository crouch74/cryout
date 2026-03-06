import { compatRuleset } from './content.ts';

export const metadata = {
  id: compatRuleset.id,
  name: compatRuleset.name,
  subtitle: 'Bread, Nation, and the Streets',
  version: '0.1.0',
  supportedLocales: ['en', 'fr', 'ar', 'ar-EG'],
  summary: compatRuleset.description,
  assets: {
    board: 'egypt_1919_board.svg',
  },
  legacyRulesetId: compatRuleset.id,
};
