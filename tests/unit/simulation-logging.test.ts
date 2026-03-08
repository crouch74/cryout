import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import {
  createSimulationLogger,
  logDebug,
  logError,
  logInfo,
  logSuccess,
  logVerbose,
  logWarn,
  withSimulationLogger,
} from '../../src/simulation/logging.ts';

const ANSI_WARN_LINE = new RegExp(`${String.raw`\u001b\[33m`}.*\\[WARN\\].*warning line${String.raw`\u001b\[0m`}`);
const ANSI_ERROR_LINE = new RegExp(`${String.raw`\u001b\[31m`}.*\\[ERROR\\].*error line${String.raw`\u001b\[0m`}`);
const ANSI_ESCAPE = new RegExp(String.raw`\u001b\[`);

test('simulation logger applies levels, colors console output, and writes plain text logs to file', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'stones-logger-'));
  const logFilePath = join(tempDir, 'optimizer.log');
  const consoleStdout: string[] = [];
  const consoleStderr: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args: unknown[]) => {
    consoleStdout.push(args.join(' '));
  };
  console.error = (...args: unknown[]) => {
    consoleStderr.push(args.join(' '));
  };

  try {
    const logger = await createSimulationLogger({
      scope: 'optimizer/test',
      logFilePath,
      consoleMinLevel: 'warn',
      fileMinLevel: 'debug',
    });

    await withSimulationLogger(logger, async () => {
      logDebug('debug detail');
      logVerbose('verbose progress');
      logInfo('informational line');
      logSuccess('success line');
      logWarn('warning line');
      logError('error line');
    });

    await logger.close();

    assert.equal(consoleStdout.length, 0);
    assert.equal(consoleStderr.length, 2);
    assert.match(consoleStderr[0] ?? '', ANSI_WARN_LINE);
    assert.match(consoleStderr[1] ?? '', ANSI_ERROR_LINE);

    const persisted = await readFile(logFilePath, 'utf8');
    assert.match(persisted, /\[DEBUG\] \[optimizer\/test\] debug detail/);
    assert.match(persisted, /\[VERBOSE\] \[optimizer\/test\] verbose progress/);
    assert.match(persisted, /\[INFO\] \[optimizer\/test\] informational line/);
    assert.match(persisted, /\[SUCCESS\] \[optimizer\/test\] success line/);
    assert.match(persisted, /\[WARN\] \[optimizer\/test\] warning line/);
    assert.match(persisted, /\[ERROR\] \[optimizer\/test\] error line/);
    assert.doesNotMatch(persisted, ANSI_ESCAPE);
  } finally {
    console.log = originalLog;
    console.error = originalError;
    await rm(tempDir, { recursive: true, force: true });
  }
});
