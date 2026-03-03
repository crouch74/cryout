# Scenario Framework

## Architecture Overview

This repo now has two layers:

- `core/`
  The canonical scenario-agnostic engine surface. It owns generic state, commands, effects, rules evaluation, persistence, validation, RNG, and testing utilities.
- `scenarios/`
  Pluggable scenario modules. A scenario declares metadata, setup, content, rules, behaviors, UI adapters, migrations, and lifecycle hooks.

The old `engine/` surface still exists, but it is now a compatibility facade:

- `engine/legacy/*`
  Deprecated bridge code for the current app, room service, and existing tests.
- `engine/index.ts`
  Re-exports the legacy API plus the new canonical `core/` and `scenarios/` entrypoints.

## Core Vs Scenario Modules

### Core Owns

- `CoreGameState`
- `CoreCommand`
- `CoreEffect`
- RNG state and deterministic shuffling
- Generic reducer flow
- FIFO effect queue
- Structured events and logs
- Rules evaluation plumbing
- Save envelopes and migrations
- Invariant and scenario conformance checks

### Scenario Modules Own

- Scenario ids, names, versions, locale support, and asset refs
- Track names, zone names, deck lists, and card definitions
- Phase order
- Action resolvers and card resolvers
- Win and lose evaluators
- Cost overrides and validators
- System step logic and weighted policy definitions
- UI labels, board definitions, event formatting, and result formatting
- Scenario state migrations

## Folder Structure

```text
core/
  index.ts
  version.ts
  ids.ts
  types.ts
  rng.ts
  createGame.ts
  reducer.ts
  selectors.ts
  commands/
  effects/
  events/
  rules/
  ai/
  persistence/
  validation/
  testing/

scenarios/
  index.ts
  registry.ts
  types.ts
  defineScenario.ts
  shared/
  testing/
  base_design/
  tahrir_square/
  woman_life_freedom/
  example_hooks/

engine/
  index.ts
  legacy/
```

## Core Components

### State Model

Implemented in [core/types.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/core/types.ts).

`CoreGameState` is normalized and serializable:

- `players`
- `tracks`
- `resources`
- `zones`
- `entities`
- `decks`
- `flags`
- `counters`
- `log`
- `commandLog`
- `scenarioState`

Core does not know what a “region”, “domain”, “beacon”, or “mandate” is. Scenarios project those concepts into generic tracks, zones, entities, and scenario state.

### Command Processor

Implemented in [core/reducer.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/core/reducer.ts).

`dispatchCoreCommand()` does this in order:

1. Validate built-in command shape.
2. Validate scenario action legality.
3. Append the command to `commandLog`.
4. Run lifecycle hooks.
5. Resolve scenario behavior into effects.
6. Resolve effects in FIFO order.
7. Run outcome evaluators.
8. Run invariant checks.

### Effect System

Implemented in:

- [core/effects/types.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/core/effects/types.ts)
- [core/effects/primitives.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/core/effects/primitives.ts)
- [core/effects/queue.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/core/effects/queue.ts)

Core effects are generic primitives such as:

- `adjustTrack`
- `adjustPlayerResource`
- `adjustZoneCounter`
- `drawCard`
- `discardCard`
- `setFlag`
- `adjustCounter`
- `advancePhase`
- `emitEvent`
- `appendLog`

Child effects are always appended to the queue tail. They never jump ahead of already queued work.

### Event Bus

Implemented in [core/events/bus.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/core/events/bus.ts).

The core emits structured events, not scenario prose. Scenario UI adapters format those events for presentation.

### Rules

Implemented in:

- [core/rules/runner.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/core/rules/runner.ts)
- [core/rules/predicates.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/core/rules/predicates.ts)
- [core/rules/modifiers.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/core/rules/modifiers.ts)
- [core/rules/outcomes.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/core/rules/outcomes.ts)

Scenarios supply:

- predicate evaluators
- action validators
- action cost calculators
- modifier providers
- win evaluators
- lose evaluators

### RNG

Implemented in [core/rng.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/core/rng.ts).

Use `createRng()`, `nextInt()`, `nextRandom()`, and `shuffle()`. Do not call `Math.random()` in scenario code.

### Persistence

Implemented in:

- [core/persistence/serialize.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/core/persistence/serialize.ts)
- [core/persistence/migrate.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/core/persistence/migrate.ts)
- [core/persistence/schemas.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/core/persistence/schemas.ts)

Save envelopes store:

- `coreVersion`
- `scenarioId`
- `scenarioVersion`
- `state`
- `commandLog`

Load order:

1. Parse JSON
2. Validate envelope shape
3. Migrate core state
4. Load the scenario module
5. Migrate scenario state
6. Validate invariants

## Scenario Interface

The canonical scenario contract is defined in [core/types.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/core/types.ts) and re-exported by [scenarios/types.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/scenarios/types.ts).

```ts
export interface ScenarioModule {
  metadata: ScenarioMetadata;
  setup: ScenarioSetup;
  content: ScenarioContent;
  rules: ScenarioRules;
  behaviors: ScenarioBehaviors;
  ui: ScenarioUiAdapter;
  observability?: ScenarioObservability;
  migrations: ScenarioMigrationRegistry;
  hooks: ScenarioLifecycleHooks;
}
```

### Metadata

- `id`
- `name`
- `version`
- `supportedLocales`
- `summary`
- `assets`
- `legacyRulesetId` optional for compatibility-bridged scenarios

### Setup

- `buildInitialState(options, helpers)`
- `visibility` optional redaction policy

### Content

- `dictionary`
- `localeNamespaces`
- `cards`
- `decks`
- `trackDefinitions`
- `zoneDefinitions`
- `assets`
- `legacy` optional compatibility metadata

### Rules

- `phases`
- `predicates`
- `winEvaluators`
- `loseEvaluators`
- `actionValidators`
- `actionCostCalculators`
- `modifiers`
- `difficultyHooks`

### Behaviors

- `actionResolvers`
- `cardResolvers`
- `deckFactories`
- `systemTurnScript`
- `weightedRandomPolicies`
- `crisisInjectionRules`
- `commandBridge` optional compatibility bridge

### UI

- `getLabel()`
- `getTrackOrder()`
- `getZoneOrder()`
- `getBoardDefinition()`
- `getIcon()`
- `getColor()`
- `formatEvent()`
- `formatResult()`

### Observability

- `formatLogEntry()`
- `analytics()`
- `inspect()`

### Migrations

- `migrateScenarioState`

### Lifecycle Hooks

`defineScenario()` in [scenarios/defineScenario.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/scenarios/defineScenario.ts) fills every hook with a no-op by default:

- `onScenarioLoad(ctx)`
- `onGameSetup(ctx)`
- `onRoundStart(ctx)`
- `onPhaseStart(phaseId, ctx)`
- `onBeforeAction(action, ctx)`
- `onAfterAction(action, ctx)`
- `onEffectResolve(effect, ctx)`
- `onCardDraw(deckId, card, ctx)`
- `onCardResolve(card, ctx)`
- `onRoundEnd(ctx)`
- `onGameEnd(result, ctx)`

## How To Create A New Scenario

Use [scenarios/example_hooks/](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/scenarios/example_hooks) as the reference.

Checklist:

1. Create `scenarios/<id>/metadata.ts`.
2. Create `scenarios/<id>/content.ts`.
3. Create `scenarios/<id>/setup.ts`.
4. Create `scenarios/<id>/rules.ts`.
5. Create `scenarios/<id>/behaviors.ts`.
6. Create `scenarios/<id>/ui.ts`.
7. Create `scenarios/<id>/observability.ts` if needed.
8. Create `scenarios/<id>/migrations.ts`.
9. Create `scenarios/<id>/index.ts` and wrap the module with `defineScenario()`.
10. Add locale JSON under `scenarios/<id>/locales/`.
11. Register the scenario in [scenarios/registry.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/scenarios/registry.ts).
12. Add tests in `tests/scenario-framework.test.ts` or a dedicated test file.

If the scenario is still backed by the legacy engine:

1. Define canonical content under `scenarios/<id>/`.
2. Keep `content/scenarios/<id>/pack.ts` as a shim re-export.
3. Register the module with `withLegacyBridge(...)`.

## Extension Point Examples

### Add A New Deck And Resolver

From [scenarios/example_hooks/content.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/scenarios/example_hooks/content.ts):

```ts
decks: {
  spark: ['data_collective_memory', 'scripted_breakthrough'],
}
```

From [scenarios/example_hooks/behaviors.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/scenarios/example_hooks/behaviors.ts):

```ts
cardResolvers: {
  resolve_scripted_breakthrough() {
    return [
      { type: 'adjustTrack', trackId: 'hope', delta: 2, clamp: { min: 0, max: 10 } },
      { type: 'setFlag', flagId: 'breakthroughResolved', value: true },
    ];
  },
}
```

### Define A New Win Condition

From [scenarios/example_hooks/rules.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/scenarios/example_hooks/rules.ts):

```ts
const winEvaluators: OutcomeEvaluator[] = [
  (state, scenario) => {
    const expression = {
      kind: 'all' as const,
      rules: [
        { kind: 'predicate' as const, predicateId: 'hope_at_least', args: { value: 5 } },
        { kind: 'predicate' as const, predicateId: 'breakthrough_resolved' },
      ],
    };

    return evaluateRuleExpression(state, expression, scenario)
      ? { status: 'won', reasonId: 'example_hooks.collective_breakthrough', summary: { hope: state.tracks.hope.value } }
      : null;
  },
];
```

### Override Action Costs

From [scenarios/example_hooks/rules.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/scenarios/example_hooks/rules.ts):

```ts
const costCalculators: ActionCostCalculator[] = [
  (state, action) => {
    if (action.id !== 'archive_testimony') {
      return [];
    }

    const cost = state.tracks.pressure.value >= 4 ? 2 : 1;
    return [{ resourceId: 'testimony', amount: cost, source: 'example_hooks.archive_testimony' }];
  },
];
```

### Inject A New Phase

From [scenarios/example_hooks/rules.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/scenarios/example_hooks/rules.ts):

```ts
phases: [
  { id: 'briefing', labelKey: 'scenario.example_hooks.phase.briefing', order: 0 },
  { id: 'story_pulse', labelKey: 'scenario.example_hooks.phase.story_pulse', order: 1 },
  { id: 'system', labelKey: 'scenario.example_hooks.phase.system', order: 2 },
  { id: 'coalition', labelKey: 'scenario.example_hooks.phase.coalition', order: 3 },
  { id: 'resolution', labelKey: 'scenario.example_hooks.phase.resolution', order: 4 },
]
```

### Customize System Step Behavior

From [scenarios/example_hooks/behaviors.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/scenarios/example_hooks/behaviors.ts):

```ts
systemTurnScript(state, scenario) {
  const policy = scenario.behaviors.weightedRandomPolicies?.system_choice?.(state, scenario) ?? [];
  const effects = nextSystemEffect(state);
  effects.push({
    type: 'emitEvent',
    event: {
      id: `example_hooks.policy.${state.counters.systemSteps ?? 0}`,
      type: 'example_hooks.weighted_policy',
      source: 'example_hooks.system',
      payload: { weights: policy.map((entry) => `${entry.id}:${entry.weight}`) },
      tags: ['system', 'weights'],
      level: 'debug',
    },
  });
  return effects;
}
```

### Add Localization Keys And Label Providers

Use:

- [scenarios/example_hooks/locales/en.json](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/scenarios/example_hooks/locales/en.json)
- [scenarios/example_hooks/ui.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/scenarios/example_hooks/ui.ts)

```ts
getLabel(id, fallback) {
  const labels: Record<string, string> = {
    hope: 'Hope',
    pressure: 'Pressure',
    commons: 'Commons',
  };
  return labels[id] ?? fallback ?? id;
}
```

### Add A Migration

From [scenarios/example_hooks/migrations.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/scenarios/example_hooks/migrations.ts):

```ts
migrateScenarioState: {
  '1.0.1': (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }

    return {
      ...value,
      migrationApplied: true,
    };
  },
},
```

## Testing Guidance

Current framework tests live in [tests/scenario-framework.test.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/tests/scenario-framework.test.ts).

Recommended test cases:

- scenario registry includes the scenario
- conformance returns zero errors
- `createGameState()` is deterministic for a fixed seed
- native actions resolve expected effects
- lifecycle hooks fire and return events
- card draw and card resolve hooks emit events
- win evaluator produces a terminal result when expected
- lose evaluator produces a terminal result when expected
- save round-trip preserves scenario id and state
- scenario migration mutates scenario state as expected
- invariant validation catches invalid deck or entity references

For legacy-backed scenarios, add at least:

- bridge initialization produces projected core state
- bridge dispatch accepts the current legacy command set
- projected core state still carries `scenarioState.legacyState`

## Common Pitfalls

- Do not import `src/**`, `content/**`, or `scenarios/**` from `core/**`.
- Do not put rendered strings into core state.
- Do not add `if (scenarioId === '...')` inside `core/`.
- Do not use `Math.random()`.
- Do not add new scenario content under `content/` as the canonical source. Use `scenarios/<id>/` and keep `content/` as a shim only when needed for compatibility.
- Do not bypass `defineScenario()`. It supplies required no-op hooks and keeps conformance tests honest.
- Do not store scenario-only counters as top-level core fields. Use `tracks`, `zones`, `entities`, `counters`, or `scenarioState`.

## Compatibility Rules

### Saves

- New canonical saves use `core/persistence/*`.
- Legacy engine saves still use `engine/legacy/serializer.ts`.
- Scenario migration runs after core migration.
- Invariants run after both migrations.

### Shipped Scenarios

- `base_design`
- `tahrir_square`
- `woman_life_freedom`

These currently register through `withLegacyBridge(...)` in [scenarios/registry.ts](/Users/aeid/git_tree/boardgames/The%20stones%20are%20crying%20outt/scenarios/registry.ts). Their canonical content now lives under `scenarios/<id>/`, but runtime behavior still routes through the deprecated bridge so the current app and room service keep working.

### Expansions

Add expansions as new scenario modules or as scenario-version upgrades with migrations. Do not repair base mechanics in `core/`. If an expansion needs more depth, extend the scenario module and migrate scenario state forward.

## Design Approach Comparison

| Approach | How it works | Pros | Cons | Best when |
| --- | --- | --- | --- | --- |
| Config-only scenario | Mostly data files | Fast, simple | Breaks down for custom rule timing | Static rulesets |
| Hook-based scenario | Scenario provides hooks, rules, behaviors, and content | Flexible, testable, scales across scenarios | More boilerplate | Multiple evolving scenarios |
| Scripting/DSL | Cards and rules execute from a script layer | Designer-friendly | Tooling and safety cost | Large live content catalogs |

Recommendation in this repo: hook-based scenario modules, with data-driven content where possible and scripted resolvers only when timing or interaction complexity requires them.
