import { compatRuleset } from './content.ts';

export const metadata = {
  id: compatRuleset.id,
  name: compatRuleset.name,
  version: '0.10.1',
  supportedLocales: ['en', 'fr', 'ar', 'ar-EG'] as string[],
  summary: compatRuleset.description,
  assets: {
    board: compatRuleset.board.assetPath,
  },
  legacyRulesetId: compatRuleset.id,
};
