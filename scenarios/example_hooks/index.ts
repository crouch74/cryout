import { defineScenario } from '../defineScenario.ts';
import { behaviors } from './behaviors.ts';
import { content } from './content.ts';
import { metadata } from './metadata.ts';
import { migrations } from './migrations.ts';
import { observability } from './observability.ts';
import { rules } from './rules.ts';
import { setup } from './setup.ts';
import { ui } from './ui.ts';

const scenario = defineScenario({
  metadata: { ...metadata },
  setup,
  content: { ...content },
  rules,
  behaviors,
  ui,
  observability,
  migrations,
  hooks: {
    onScenarioLoad() {
      return {
        debug: ['🧭 Example scenario loaded.'],
      };
    },
    onGameSetup() {
      return {
        effects: [
          {
            type: 'emitEvent',
            event: {
              id: 'example_hooks.setup',
              type: 'example_hooks.game_setup',
              source: 'example_hooks',
              payload: { ready: true },
              tags: ['setup'],
              level: 'info',
            },
          },
        ],
      };
    },
    onRoundStart() {
      return {
        debug: ['🌅 Example round started.'],
      };
    },
    onPhaseStart(phaseId) {
      return {
        debug: [`⏱️ Entered phase ${phaseId}.`],
      };
    },
    onBeforeAction(action) {
      return {
        debug: [`🎬 Before action ${action.id}.`],
      };
    },
    onAfterAction(action) {
      return {
        debug: [`✅ After action ${action.id}.`],
      };
    },
    onEffectResolve(effect) {
      return {
        debug: [`🧩 Effect resolved: ${effect.type}.`],
      };
    },
    onCardDraw(deckId, card) {
      return {
        events: [
          {
            id: `example_hooks.card_draw.${card.id}`,
            type: 'example_hooks.card_draw',
            source: deckId,
            payload: { cardId: card.id },
            tags: ['card', 'draw'],
            level: 'info',
          },
        ],
      };
    },
    onCardResolve(card) {
      return {
        events: [
          {
            id: `example_hooks.card_resolve.${card.id}`,
            type: 'example_hooks.card_resolve',
            source: card.id,
            payload: { cardId: card.id },
            tags: ['card', 'resolve'],
            level: 'info',
          },
        ],
      };
    },
    onRoundEnd() {
      return {
        debug: ['🌇 Example round ended.'],
      };
    },
    onGameEnd(result) {
      return {
        events: [
          {
            id: `example_hooks.game_end.${result.reasonId}`,
            type: 'example_hooks.game_end',
            source: 'example_hooks',
            payload: { result: result.reasonId },
            tags: ['game_end'],
            level: 'info',
          },
        ],
      };
    },
  },
});

export default scenario;
