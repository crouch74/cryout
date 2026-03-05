PURPOSE

This file ensures that all AI agents (Codex, GPT-based systems, automated writers, code generators) remain fully aligned with the official design, mechanics, tone, and political framing of Where the Stones Cry Out.

Agents must treat this document as binding guidance.

NON-NEGOTIABLE DESIGN PILLARS

Agents must validate every output against these principles:

Global South Agency
Movements from the Global South are protagonists.
No savior narratives. No external hero framing.

Systemic Opponent
The antagonist is the System (extraction, militarism, co-opted elites).
Never design a player-controlled villain.

Bittersweet Outcomes
Victory is costly and incomplete.
Defeat carries continuation, not nihilism.

Cooperation with Tension
Players cooperate but have Secret Mandates.
Internal tension is intentional and mechanical.

Modular Expansions
Expansions deepen complexity.
They must never repair broken base systems.

If a request contradicts these pillars, the agent must ask for clarification or reframe the request.

UI CONSISTENCY DIRECTIVE (NON-NEGOTIABLE)

The Home screen is the canonical visual baseline for shell-level UI.

When generating or modifying UI:

All non-game shell screens (Rules Brief, Player Guide, Board Tour, Room Lobby, and future siblings) must match Home style language.

Use the same flatness profile:
compact radii, thin borders, restrained shadows, and no legacy beveled/puffy card treatment.

Use icon-led controls and action labels consistent with Home patterns.

Reuse shared tokens and shared component patterns instead of screen-specific visual forks.

When updating one shell screen, audit adjacent shell screens for drift and align them in the same change set.

If a requested UI change introduces style drift from Home, reframe it to preserve cross-screen consistency.

CANONICAL TERMINOLOGY (Allow for translations and localisation)

Extraction Tokens — Black hexes placed in regions (0–6).
Global Gaze — Global attention/media track (0–20).
War Machine — Militarism escalation track (0–12).
Comrades — Red cubes representing people and cost.
Evidence — Blue cubes representing documentation/proof.
Domains — System pressures (War Machine, Dying Planet, etc.).
Secret Mandates — Hidden player objectives with hard failure risk.

MECHANICAL TRUTH REQUIREMENTS

When generating rules, content, or code:

Launch Campaign uses 2d6 with target 8+ unless officially changed.

Regions lose at 6 Extraction Tokens.

A player reaching 0 Comrades triggers defeat.

Global tracks must respond to narrative and mechanical events.

Secret Mandates carry real mechanical consequences.

If uncertain about a rule, the agent must ask rather than assume.

NARRATIVE & REPRESENTATION RULES

Avoid:

Colonial framing

“Tech savior” solutions

Simplistic good/evil narratives

Graphic or exploitative depictions

Use:

Movement-centered framing

Systemic analysis

Dignified tone

Politically clear but educational language

When naming perpetrators (corporations, militaries, institutions), do so responsibly and contextually.

RESPONSE VALIDATION PROTOCOL

Before finalizing output, agents must internally check:

Does this reinforce Global South agency?

Does it preserve systemic framing?

Are canonical terms used correctly?

Are mechanics accurate?

Does tone match bittersweet determination?

If any answer is no, revise before responding.

CODE GENERATION RULES

When generating code:

Add meaningful log messages with relevant emojis.

Comment rule decisions clearly.

Tie logic directly to design principles.

Example of acceptable log style:

🎲 Launch Campaign roll resolved
🚩 War Machine escalated to 6
🧱 Extraction Token removed from Mekong

Never generate placeholder mechanics that contradict official systems.

PROMPT CORRECTION POLICY

If a user prompt violates core pillars:

Do not comply directly.

Reframe it to align with the design.

Explain reasoning briefly if necessary.

Example correction pattern:

Instead of designing a single hero who “saves” a region, focus on collective movement strategy against systemic pressure.

VERSION CONTROL

Agents must check version number before generation.
If referenced rules conflict with the latest design document, request confirmation.

FAILURE HANDLING

If a generated output violates this file:

Correct the framing immediately.

Realign terminology.

Re-anchor mechanics to documented rules.

This document overrides stylistic convenience and creative deviation.

New commits must have long form commit messages like in the commit history.
