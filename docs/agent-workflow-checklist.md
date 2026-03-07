# Agent Workflow Checklist

Use this checklist to keep task delivery consistent with project rules, mechanics, and quality expectations.

## 1. Intake Checklist

- Confirm the requested outcome and affected surfaces.
- Check for conflicts with the design pillars in `AGENTS.md`.
- Confirm canonical terms needed for the task (Extraction Tokens, Global Gaze, War Machine, Comrades, Evidence, Domains, Secret Mandates).
- Note constraints: no savior framing, systemic analysis required, dignified tone.

## 2. Pre-Change Checks

- Read current implementation or docs before proposing edits.
- Verify rule/version context in `src/engine/version.ts` and relevant `CHANGELOG.md` notes.
- Identify adjacent surfaces that may drift (especially shell screens aligned to Home style).
- Confirm whether the task is docs-only, code-only, or mixed.

## 3. Change Checklist

- Keep edits scoped to the requested outcome.
- Align terminology exactly with canonical terms.
- For shell UI work, preserve Home-aligned visual language across sibling screens.
- Reuse shared tokens/components rather than introducing one-off patterns.
- For code changes, include meaningful emoji-prefixed logs and clear rule comments where needed.
- For card-writing work, make the gameplay effect explicit in player-facing text when the card adds a campaign modifier, grants resources, removes resources, or applies persistent pressure.
- For crisis and system cards, state the direct track / Extraction / persistent effect in the card text instead of implying it through flavor.
- Do not leave support cards mechanically ambiguous; a player should not need the modal chrome or source code to understand the card's direct effect.

## 4. Validation Checklist

- Run targeted tests for changed surfaces first.
- Run broader checks when warranted:
  - `npm run lint`
  - `npm test`
  - `npm run test:e2e`
  - `npm run build`
- Manually verify mechanics if rules were touched:
  - `Launch Campaign` roll baseline (`2d6`, target `8+`)
  - region loss at `6` Extraction Tokens
  - defeat at `0` Comrades
  - live response of global tracks to events
  - mandate consequence enforcement

## 5. Delivery Checklist

- Report changed files and why they changed.
- Report validation performed and exact commands run.
- Call out known limitations, assumptions, or residual risks.
- If a task could not be fully validated, state that explicitly.
- Follow repository history convention: new commits must use long-form commit messages.
