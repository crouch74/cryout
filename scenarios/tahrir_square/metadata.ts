import { legacyRuleset } from './content.ts';

export const metadata = {
  id: legacyRuleset.id,
  name: legacyRuleset.name,
  version: '0.10.1',
  supportedLocales: ['en', 'ar-EG'] as string[],
  summary: legacyRuleset.description,
  assets: {
    board: legacyRuleset.board.assetPath,
  },
  legacyRulesetId: legacyRuleset.id,
};
