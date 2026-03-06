import { chmodSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const hooksDir = path.join(repoRoot, '.githooks');
const prePushHook = path.join(hooksDir, 'pre-push');

if (!existsSync(prePushHook)) {
  console.warn('⚠️ Skipping git hook install because .githooks/pre-push is missing.');
  process.exit(0);
}

try {
  chmodSync(prePushHook, 0o755);
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
  console.log('🪝 Git hooks installed via core.hooksPath=.githooks');
} catch (error) {
  console.warn('⚠️ Unable to install git hooks automatically. Run `git config core.hooksPath .githooks` in this repo if needed.');
  console.warn(error instanceof Error ? error.message : String(error));
}
