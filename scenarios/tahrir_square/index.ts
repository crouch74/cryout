import { defineScenario } from '../defineScenario.ts';
import { buildLegacyScenarioContent } from '../shared/legacyScaffold.ts';
import { behaviors } from './behaviors.ts';
import { legacyRuleset } from './content.ts';
import { metadata } from './metadata.ts';
import { migrations } from './migrations.ts';
import { observability } from './observability.ts';
import { rules } from './rules.ts';
import { setup } from './setup.ts';
import { ui } from './ui.ts';

const scenario = defineScenario({
  metadata: { ...metadata },
  setup,
  content: buildLegacyScenarioContent(legacyRuleset),
  rules,
  behaviors,
  ui,
  observability,
  migrations,
});

export default scenario;
