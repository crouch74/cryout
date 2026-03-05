import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { VictoryTrajectory } from '../trajectory/types.ts';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function buildRunStamp(date = new Date()) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    'T',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    'Z',
  ].join('');
}

export async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

export async function writeJson(path: string, value: unknown) {
  await ensureDir(dirname(path));
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function writeMarkdown(path: string, markdown: string) {
  await ensureDir(dirname(path));
  await writeFile(path, `${markdown.endsWith('\n') ? markdown : `${markdown}\n`}`, 'utf8');
}

export function resolveOptimizerOutputRoot(outDir: string, scenarioId: string, seed: number, stamp: string) {
  return resolve(outDir, scenarioId, `${stamp}_${seed}`);
}

export async function loadTrajectoryFiles(inputDir: string): Promise<VictoryTrajectory[]> {
  const entries = await readdir(inputDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => join(inputDir, entry.name))
    .sort((left, right) => left.localeCompare(right));

  const trajectories: VictoryTrajectory[] = [];
  for (const filePath of files) {
    const payload = await readFile(filePath, 'utf8');
    trajectories.push(JSON.parse(payload) as VictoryTrajectory);
  }
  return trajectories;
}
