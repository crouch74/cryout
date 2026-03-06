# AI Agent Documentation: Comprehensive Hybrid Evolutionary Optimizer Architecture

**PURPOSE**
This document serves as the absolute, deeply verbose canonical technical reference for AI agents interacting with, modifying, or analyzing the Scenario Optimizer (`src/simulation/optimizer/`). It details the hyper-parallelized 3-stage hybrid architecture, the compounding iteration loop, the deep mathematical decision engine, and the safety measures implemented for memory stability at massive scales.

---

## 1. The Global Iteration Loop (Compounding Adaptations)

The optimizer does not execute a single flat search. It operates an **Iterative Meta-Loop** (`src/simulation/optimizer/engine.ts`). This is effectively an autonomous hill-climbing algorithm mapped over evolutionary steps.

1. **Iteration `N` Starts**: The system loads the current "Baseline" scenario definition.
2. **Exploration & Exploitation**: The 3-Stage pipeline runs (GA → Scoring → A/B Testing).
3. **Decision Phase**: If a candidate patch (Arm B) mathematically outperforms the Baseline (Arm A) and passes all rigorous structural checks, it is flagged as `ACCEPTED`.
4. **Compounding the Patch**: The accepted JSON `ScenarioPatch` is permanently applied to the scenario definition in memory. This mutated state immediately becomes the **New Baseline** for Iteration `N+1`.
5. **The Climb**: In Iteration `N+1`, the Genetic Algorithm initializes its population based on this *new* baseline, exploring outward from the new peak. Changes mathematically compound over iterations, driving the scenario toward exact numerical balance without reverting previous gains.

If the decision is `REJECTED` or `NEEDS_MORE_DATA`, the Baseline remains intact, and the system attempts different candidate patches.

---

## 2. Mass Parallelization & Sharded I/O (The Engine Room)

To run millions of full board game simulations within minutes, the optimizer relies on ruthless parallelization via Node.js `worker_threads` (`src/simulation/autoplayEngine.ts`).

### The Simulation Spooler
- Instead of running simulations on the main thread, the engine generates an array of immutable `PlannedSimulationRun` objects.
- Each run defines a deterministic seed, the active patch, the selected arm (A or B), and a randomly sampled player count (e.g., `[2, 3, 4]`).
- The workload is distributed using `mapWithConcurrency` across a pool of isolated Node.js workers.

### Sharded NDJSON Aggregation
- Returning millions of complex simulation state objects via IPC (Inter-Process Communication) would instantly crash the V8 heap.
- Instead, each worker writes its results directly to disk as **NDJSON (Newline Delimited JSON)** inside heavily sharded temp directories (`arm_A_shards/`, `arm_B_shards/`).
- **The Accumulator**: Once the workers finish, the main thread's `createArmAccumulator` streams these files from disk, aggregating the metrics linearly (summing wins, turns, mandate failures) without ever holding the raw simulation logs in RAM.

---

## 3. The 3-Stage Pipeline: Detailed Mechanics

### Stage 1: Evolutionary Discovery (GA Exploration)
- **Module:** `src/simulation/optimizer/ga/`
- **Mechanism:** Explores the multidimensional parameter space (the `PatchGenome`) without human bias.
- **Initialization:** An initial population (default 30) of randomized `GaIndividual` objects.
- **The Evaluation Loop (per generation):**
  - **Worker Dispatch:** The GA dispatches exactly 1,000 simulations per individual to the worker pool.
  - **Elitism:** The top 3 individuals (highest fitness) of generation $G$ are preserved exactly to generation $G+1$, preventing the search from losing ground.
  - **Tournament Selection (k=3):** 3 random individuals are pulled from the population. The one with the highest fitness is chosen as a "parent".
  - **Uniform Crossover (60%):** Pairs of parents swap generic traits. 
    - *Agent Directive:* Crossover is strictly guarded. If `publicVictoryWeight` is inherited, `mandatesWeight` MUST invert it mathematically to equal 100%. The genome must never enter an illegal state.
  - **Mutation (15%):** Small chance for a specific dial to increment or decrement randomly.
- **Promotion:** At generation 10, the absolute 5 fittest candidates escape the GA pool and are promoted to Stage 3.

### Stage 2: Fast Fitness Scoring (The Heuristic)
- **Execution:** Happens deep inside the GA during Stage 1.
- **The Formula (`src/simulation/optimizer/fitness.ts`):** 
  - $Fitness = \text{Primary Lift} - \text{Severe Penalties}$
  - **Target Optimization:** It calculates the distance between the candidate's `successRate` and the designer's target balance band (e.g., 40%).
  - **Catastrophic Punishments:** An individual's fitness is dropped to $0.0$ if it produces:
    - Turn 1 victories.
    - Immediate game-over structural collapses (0% survival rate).
    - Impossible mandate conditions (100% failure rate for a specific faction).

### Stage 3: The Scientific Gatekeeper (A/B Testing)
- **Mechanism:** The promoted GA candidates enter a massive, head-to-head A/B test.
- **Rigor:** 3,000+ simulations per Arm (A = Baseline, B = Candidate). Minimum 6,000 total games simulated per decision.
- **The Crucible:** The candidate must prove it is statistically superior to the baseline, not just a product of a lucky RNG seed in the GA.

---

## 4. The Decision Engine: Statistical Rigor & Guardrails

After the A/B test concludes, the Decision Engine acts as the final arbiter. A patch MUST pass three layers of judgment to be `ACCEPTED`.

### Layer 1: Lift & Confidence (The Math)
- The system checks the absolute Lift: $Lift = ArmB_{success} - ArmA_{success}$. 
- If the target is to increase win rate, the Lift must be $> 0$.
- **The p-value:** The system runs a rigorous statistical test (Z-test or binomial equivalent) between Arm A and Arm B to calculate a $p$-value.
- **The Gate:** If $p > 0.05$, the system declares `NEEDS_MORE_DATA`. The variance is too high. The candidate is skipped. It cannot become the new baseline.

### Layer 2: Structural Diagnostics (The Guardrails)
Even if the $p$-value is $0.001$, the engine runs a deep secondary diagnostic (`detectStructuralDiagnostics`) on Arm B's output. It will instantly `REJECT` the candidate (flagging a `STRUCTURAL_REGRESSION`) if:
1. **Impossible Mandates:** A specific faction's hidden objective failure rate exceeds 95%.
2. **Setup-Phase Cheese:** `victoryBeforeAllowedRoundRate` > 0. Players cannot win on Turn 1 or 2 by sheer luck.
3. **No-Gameplay Terminations:** `earlyTerminationRate` > 5%. The system pressure is escalating too fast, auto-defeating players before they take meaningful turns.
4. **Hollow Victories:** `publicVictoryRate` > 50% but True `successRate` < 5%. This indicates the victory threshold is trivially easy, but players are constantly losing via secondary mechanics.

### Layer 3: Dynamic Player Scaling Enforcement
- The optimizer simulates against combinations of 2-player, 3-player, and 4-player games.
- The reporting engine breaks out metrics by scale.
- A valid candidate must not break the game for a 2-player setup to fix a 4-player setup. Balance must be maintained across all scaling variants.

---

## 5. Trajectory Mining & Deep Memory Safety

As the optimizer simulates games, it captures the exact "move-by-move" history of successful games for human review.

### The Trajectory Spool
- Whenever an AI strategy script achieves a "Public Victory", it pushes the detailed log (the Trajectory) to the worker's stack.
- To prevent the main thread from suffocating under gigabytes of JSON, trajectories are written directly to disk.

### Critical Heap Safety Guard (Never Remove)
- **The 50 Cap:** A single simulation worker operates an infinite loop. If it writes too many JSON traces, the Node.js V8 garbage collector will panic and throw `Heap out of memory`.
- **The Fix:** Each worker isolates its `trajectoryRecording`. After exactly 50 logs are pushed from that specific worker thread to the disk, the worker silently locks the recording mechanism. All subsequent victories are aggregated mathematically, but their action-by-action logs are ignored.
- **Reservoir Sampling:** The main thread uses a `TrajectoryReservoir` to randomly sample these logs at the end of the experiment, writing only a curated subset mathematically proven to represent the baseline.

---

## SUMMARY OF DIRECTIVES FOR AGENTS
1. **Never alter the Guardrails:** Do not bypass the $p < 0.05$ requirement to force a patch to be accepted. The gatekeeper must remain strict.
2. **Preserve the Multi-Player Arrays:** If expanding the optimizer, ensure the `[2, 3, 4]` player count iterator arrays in `autoplayEngine.ts` continue to sample evenly across seeds.
3. **Protect the V8 Heap:** If interacting with I/O in the engine, strictly rely on NDJSON streams and the `createArmAccumulator`. Do not build large in-memory arrays of simulation results.
4. **Compounding Logic:** Understand that a single optimization request might run 1,000,000 total simulated games across 10 iterations. Ensure any code changes you make are $O(1)$ scaling where possible.
