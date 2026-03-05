# Agent Onboarding

This document is the first-stop orientation for AI agents contributing to Where the Stones Cry Out.

For binding policy and framing rules, read [../AGENTS.md](../AGENTS.md) first.

## Mission and Non-Negotiables

- Keep Global South movements as protagonists.
- Frame the antagonist as the System (extraction, militarism, co-opted elites), not as a player-controlled villain.
- Preserve bittersweet outcomes: costly victories, defeats that continue struggle.
- Respect cooperative play with intentional tension through Secret Mandates.
- Treat expansions as depth, not repairs for broken base systems.

If a task conflicts with these rules, reframe it to comply before implementation.

## Version Check Protocol (Required Before Rule Work)

Before changing mechanics, scenario content, or rules text:

1. Check the current engine version in `src/engine/version.ts` (`CORE_VERSION`).
2. Review the latest relevant notes in `CHANGELOG.md`.
3. If a prompt references rules that conflict with the current versioned design, request confirmation before editing.

Current baseline when this document was created: `0.10.1-scenario-framework.1`.

## Canonical Terminology Quick Reference

Use these terms exactly in agent-authored code comments, docs, and UI copy:

- Extraction Tokens: black hexes placed in regions (`0-6`).
- Global Gaze: global attention/media track (`0-20`).
- War Machine: militarism escalation track (`0-12`).
- Comrades: red cubes representing people and cost.
- Evidence: blue cubes representing documentation/proof.
- Domains: system pressures (War Machine, Dying Planet, etc.).
- Secret Mandates: hidden player objectives with hard failure risk.

## Mechanical Truth Checklist

Do not ship output that violates these rules:

- `Launch Campaign` uses `2d6` with target `8+` unless officially changed.
- Regions lose at `6` Extraction Tokens.
- A player reaching `0` Comrades triggers defeat.
- Global tracks must respond to narrative and mechanical events.
- Secret Mandates must carry real mechanical consequences.

If uncertain, ask or escalate for confirmation instead of assuming.

## Start in 5 Minutes

Use this sequence for a fast, safe start:

1. Read: `AGENTS.md`, this onboarding doc, then any task-relevant docs in `docs/`.
2. Locate: identify the target surface using [agent-repo-map.md](./agent-repo-map.md).
3. Implement: make the smallest coherent change set that solves the request.
4. Verify: run targeted checks and tests relevant to changed surfaces.
5. Report: summarize what changed, what was validated, and any unresolved risks.
