import type { TrajectoryStep, VictoryTrajectory } from './types.ts';

export class TrajectoryRecorder {
  private readonly steps: TrajectoryStep[] = [];

  record(step: TrajectoryStep) {
    this.steps.push(step);
  }

  stepCount() {
    return this.steps.length;
  }

  buildTrajectory(meta: Omit<VictoryTrajectory, 'steps'>): VictoryTrajectory {
    return {
      ...meta,
      steps: this.steps.slice(),
    };
  }
}

export function buildTrajectoryFileStem(trajectory: Pick<VictoryTrajectory, 'scenarioId' | 'seed' | 'players' | 'turnsPlayed'>) {
  return `${trajectory.scenarioId}_${trajectory.seed}_${trajectory.players}p_${trajectory.turnsPlayed}turns`;
}
