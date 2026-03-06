# Domains, Fronts, and Scoring Across Scenarios

## Scope and Version

This document describes the currently shipped scenarios and runtime rules in this repository.

- Core version: `0.10.1-scenario-framework.1`
- Scenario metadata version: `0.10.1`
- Scenarios covered:
  - `stones_cry_out`
  - `tahrir_square`
  - `woman_life_freedom`
  - `algerian_war_of_independence`

## Canonical Terms Used Here

- **Comrades**: movement capacity represented in code as `Comrades`.
- **Evidence**: documentation/proof.
- **Domains**: systemic pressure fronts tracked from `0` to `12`.
- **Fronts**: scenario regions where extraction and Comrades pressure play out.
- **Global Gaze**: global attention track (`0` to `20`).
- **War Machine**: militarism track (`0` to `12`).
- **Extraction Tokens**: regional extraction pressure (`0` to `6`), with breach defeat at `6`.
- **Secret Mandates**: hidden seat-level objectives; if public victory is reached but any mandate fails (when enabled), the coalition loses.

## What Domains Are and How They Work

Domains are not generic VP points; they are scenario-specific political fronts.

- Every domain has an `initialProgress` and a live progress value (`0` to `12`).
- Coalition progress usually increases domain tracks through:
  - `Launch Campaign` success (`+1` targeted domain)
  - `Build Solidarity` (`+1` selected domain)
  - card effects and scenario hooks
- Crisis/system effects can raise or lower domain values.
- Domain values are used in:
  - Secret Mandate checks
  - Beacon checks
  - scenario hooks and threshold effects

## What Fronts Are and How They Work

A **Front** is a region where board pressure is resolved.

Each front carries:

- Extraction Tokens
- Comrade presence per seat
- Defense rating
- domain vulnerability profile

Front consequences:

- Any front at `6` Extraction Tokens causes immediate defeat.
- Comrade presence in fronts gates action legality and tactical reach.
- Vulnerability targeting drives many system effects (`byVulnerability`).

## Scoring Architecture (Cross-Scenario)

Scoring is a layered reckoning resolved in the Resolution phase.

### 1. Public Victory Layer

Two modes:

- **Liberation**:
  - Default: all fronts at or below scenario `liberationThreshold`.
  - Base/Tahrir/WLF use threshold `1`.
  - Algeria overrides with a custom liberation condition.
- **Symbolic**:
  - complete all active beacons
  - beacons are activated at game start (up to three)

### 2. Secret Mandate Gate (If Enabled)

After public victory is reached:

- all mandates are evaluated
- any failure flips result to `mandate_failure` defeat
- all passing mandates preserve public victory

### 3. Defeat Layer

Defeat checks include:

- `extraction_breach`: any front reaches `6`
- `comrades_exhausted`: any seat reaches `0` total Comrades
- `sudden_death`: no decisive victory by scenario sudden-death round

### 4. Campaign Roll Layer

`Launch Campaign` is the central scoring action:

- roll: `2d6`
- base target: `8+`
- modified by Comrades, Evidence, Global Gaze, War Machine, faction bonuses, support card bonus, and active system pressure

Result bands:

- success: remove extraction, advance domain, possible War Machine reduction
- attention failure: typically raises Global Gaze
- backlash failure: adds extraction and raises War Machine

### 5. Escalation Pressure Layer

Escalation trigger checks:

- extraction threshold
- War Machine threshold
- Global Gaze collapse threshold
- failed campaign threshold
- symbolic round-six trigger

Escalations add persistent pressure modifiers and increase long-term scoring difficulty.

## Canonical Domain Catalogue (Across All Scenarios)

The ruleset supports 10 canonical domain IDs:

- `WarMachine`
- `DyingPlanet`
- `GildedCage`
- `SilencedTruth`
- `EmptyStomach`
- `FossilGrip`
- `StolenVoice`
- `RevolutionaryWave`
- `PatriarchalGrip`
- `UnfinishedJustice`

Each scenario uses a subset (or renaming) of this catalogue.

## Scenario Reference

### Base: `Where the Stones Cry Out` (`stones_cry_out`)

#### Domains (7)

- `WarMachine` (initial `1`)
- `DyingPlanet` (initial `1`)
- `GildedCage` (initial `0`)
- `SilencedTruth` (initial `1`)
- `EmptyStomach` (initial `0`)
- `FossilGrip` (initial `0`)
- `StolenVoice` (initial `0`)

#### Fronts (6)

- Congo Basin: fossil + climate extraction pressure core.
- Levant: war + carceral + truth suppression pressure.
- Amazon: climate + fossil + voice erasure pressure.
- Sahel: hunger + climate + militarization pressure.
- Mekong: fossil + climate + testimony suppression pressure.
- Andes: balanced hunger/cage/fossil/voice pressure.

#### Public Scoring

- Liberation: all fronts `<= 1` extraction.
- Symbolic: complete all active beacons.

#### Beacon Objectives (6 total; 3 active in Symbolic)

- Corridor of Return: Levant `<=1` and Global Gaze `>=10`.
- River Testimony: Mekong `<=1` and Silenced Truth `>=5`.
- Forest Sovereignty: Amazon `<=1` and Dying Planet `>=6`.
- Copper Commons: Congo `<=1` and Fossil Grip `>=5`.
- Bread Pact: Sahel `<=1` and Empty Stomach `>=5`.
- Mountain Charter: Andes `<=1` and Gilded Cage `>=5`.

#### Secret Mandates (4)

- Congo Basin Collective:
  - Congo `<=2`
  - Dying Planet `>1`
  - War Machine `<=5`
- Levant Sumud:
  - Levant `<=1`
  - War Machine `<=6`
- Mekong Echo Network:
  - Mekong `<=1`
  - Silenced Truth `>=5`
- Amazon Guardians:
  - Amazon `<=1`
  - Fossil Grip `>=5`

### 2011 — TAHRIR SQUARE (`tahrir_square`)

#### Domains (6)

- `WarMachine` as **State Security** (initial `2`)
- `SilencedTruth` as **Digital Front** (initial `1`)
- `EmptyStomach` as **Bread & Dignity** (initial `0`)
- `RevolutionaryWave` (initial `0`)
- `PatriarchalGrip` (initial `0`)
- `UnfinishedJustice` (initial `0`)

#### Fronts (6)

- Cairo: center of gravity / square-centered mobilization.
- Alexandria: Mediterranean labor front.
- Nile Delta: agrarian density front.
- Upper Egypt: neglected southern front.
- Suez: canal repression front.
- Sinai: peripheral militarized exclusion front.

#### Public Scoring

- Liberation: all fronts `<=1` extraction.
- Symbolic: complete all active beacons (3 total defined, so all are active).

#### Beacon Objectives (3)

- The 18 Days: Cairo extraction `<=2`.
- Labor-Student Alliance: Empty Stomach `>=8`.
- No to Military Trials: Unfinished Justice `==0`.

#### Secret Mandates (4)

- April 6 Youth:
  - Cairo `<=1`
- Labor Movement:
  - Alexandria `<=1`
  - Empty Stomach `>=5`
- Independent Journalists:
  - Silenced Truth `>=6`
- Rights Defenders:
  - War Machine `<=4`

#### Scenario-Specific Scoring Pressure

- If Cairo Comrades are absent for sustained rounds, Revolutionary Wave decays.
- Martyrdom effects can increase Revolutionary Wave over time.

### 2022 — WOMAN, LIFE, FREEDOM (`woman_life_freedom`)

#### Domains (8)

- `WarMachine` as **State Security** (initial `3`)
- `DyingPlanet` (initial `1`)
- `GildedCage` (initial `0`)
- `SilencedTruth` as **Digital Intranet** (initial `1`)
- `EmptyStomach` (initial `0`)
- `FossilGrip` (initial `0`)
- `StolenVoice` (initial `0`)
- `PatriarchalGrip` (initial `0`)

#### Fronts (6)

- Tehran: capital convergence front.
- Kurdistan: movement vanguard and repression front.
- Isfahan: water crisis and schoolgirl resistance front.
- Mashhad: conservative center rupture front.
- Khuzestan: oil-ecology marginalization front.
- Balochistan: massacre-marked peripheral front.

#### Public Scoring

- Liberation: all fronts `<=1` extraction.
- Symbolic: complete all active beacons (scenario defines 2 beacons).

#### Beacon Objectives (2)

- Global Solidarity:
  - Global Gaze `>=12`
  - Patriarchal Grip `<=4`
- Halt Executions:
  - War Machine `<=3`

#### Secret Mandates (4)

- Kurdish Women:
  - Patriarchal Grip `<5`
  - Kurdistan `<=1`
- University Students:
  - Tehran `<=1`
  - Silenced Truth `>=6`
- Bazaar Strikers:
  - Empty Stomach `>=5`
- Male Allies:
  - Patriarchal Grip `<=3`

#### Scenario-Specific Scoring Pressure

- Larger extraction pool (`72`) changes pressure curve.
- Region-level hijab enforcement adds extra pressure state.

### 1954 — ALGERIAN WAR OF INDEPENDENCE (`algerian_war_of_independence`)

#### Domains (6)

- `WarMachine` as **French Colonial Army** (initial `3`)
- `GildedCage` as **Torture & Detention Network** (initial `2`)
- `SilencedTruth` as **International Witness** (initial `1`)
- `UnfinishedJustice` as **Colonial Impunity** (initial `2`)
- `RevolutionaryWave` as **Liberation Cohesion** (initial `1`)
- `EmptyStomach` as **Settler Bloc** (initial `2`)

#### Fronts (6)

- Algiers: urban insurgency front.
- Kabylie Mountains: mountain endurance front.
- Oran: settler coastal reaction front.
- Sahara South: distance-stressed organizing front.
- Tunisian Border: corridor/witness frontier.
- French Metropole Influence: metropole political-media front.

#### Public Scoring

- Liberation (custom):
  - `repression_cycle <= 6`
  - every front extraction `<= 5`
- Symbolic: complete all active beacons (3 total defined, so all are active).

#### Beacon Objectives (3)

- Break the Colonial Narrative: Global Gaze `>=15`.
- Expose the Torture Network: scenario flag `tortureExposed == true`.
- Force International Reckoning: scenario flag `tribunalAcknowledged == true`.

#### Secret Mandates (4)

- FLN Urban Cells:
  - Global Gaze `>=12`
  - Algiers `<=2`
- Kabyle Maquis:
  - Revolutionary Wave `>=6`
  - Kabylie Mountains `<=1`
- Rural Organizing Committees:
  - repression_cycle `<=6`
  - Sahara South `<=2`
- Border Solidarity Networks:
  - Gilded Cage `<=4`
  - French Metropole Influence `<=2`

#### Scenario-Specific Scoring Systems

- Custom track: `repression_cycle` (`0..10`, thresholds `5/7/9`).
- Threshold triggers can force evidence loss and scenario-flag changes.
- Evidence gains can increase repression.
- Urban campaign success can escalate War Machine.
- Maxed repression can trigger round penalties.

## Comparative Scoring Matrix

| Scenario | Domains | Fronts | Liberation Rule | Symbolic Rule | Secret Mandates | Distinct Scoring Mechanics |
|---|---:|---:|---|---|---:|---|
| Base | 7 | 6 | all fronts `<=1` | all active beacons complete | 4 | baseline model |
| Tahrir | 6 | 6 | all fronts `<=1` | all active beacons complete | 4 | Empty-Square decay + Martyrdom Wave gain |
| WLF | 8 | 6 | all fronts `<=1` | all active beacons complete (2-beacon pool) | 4 | hijab enforcement + heavier extraction setup |
| Algeria | 6 | 6 | `repression_cycle<=6` AND all fronts `<=5` | all active beacons complete | 4 | repression custom track + thresholds + flags |

## Clear Critique

### Strengths

- Multi-layer scoring creates meaningful tradeoffs: public objective, private mandate, and hard-fail pressure all matter.
- Front/domain coupling preserves systemic framing: local extraction defense and structural pressure must be managed together.
- Scenario variation is substantial while the core scoring skeleton stays stable (`2d6`, target `8+`, extraction breach at `6`).
- Secret Mandate gate produces the intended cooperation-with-tension dynamic.

### Design and Implementation Risks

1. **Action-definition/runtime mismatch for some scenario actions**
   - `tahrir_square` includes `expose_regime_lies` and `call_labor_strike` in content action lists.
   - runtime action resolution switch has no explicit handlers for those IDs.
   - practical risk: selectable actions resolving with no effect.

2. **`compose_chant` text/effect mismatch**
   - action text promises a permanent regional track modifier.
   - runtime effect currently only spends Evidence.
   - practical risk: scoring expectation mismatch and player trust erosion.

3. **Symbolic objective load inconsistency**
   - engine activates up to three beacons, but WLF defines two total.
   - symbolic path difficulty can therefore be scenario-uneven unless intentional and surfaced clearly.

4. **Semantic direction ambiguity in domain labels**
   - domain progress usually means coalition advancement.
   - some names (`Patriarchal Grip`, `Gilded Cage`) read as oppressive-system strength, not resistance progress.
   - practical risk: onboarding confusion around whether “higher” is good or bad.

5. **Mandate-failure endgame shock**
   - public win converting to loss is mechanically aligned with tension goals.
   - without pre-reckoning risk cues, this can still feel abrupt in room play.

### Suggested Improvements

1. Implement or remove action IDs not handled in runtime.
2. Align action text and effect behavior (`compose_chant`).
3. Normalize or explicitly communicate symbolic objective load policy per scenario.
4. Add directionality hints for each domain track (for example “higher means movement leverage” or “target is lower”).
5. Add non-revealing mandate risk indicators before final reckoning.

## Source Files

- `src/engine/adapters/compat/runtime.ts`
- `src/engine/adapters/compat/types.ts`
- `src/scenarios/stones_cry_out/content.ts`
- `src/scenarios/tahrir_square/content.ts`
- `src/scenarios/woman_life_freedom/content.ts`
- `src/scenarios/algerian_war_of_independence/content.ts`
- `src/scenarios/stones_cry_out/boards/baseWorldBoard.ts`
- `src/scenarios/tahrir_square/boards/tahrirBoard.ts`
- `src/scenarios/woman_life_freedom/boards/womanLifeFreedomBoard.ts`
- `src/scenarios/algerian_war_of_independence/boards/algeriaBoard.ts`
