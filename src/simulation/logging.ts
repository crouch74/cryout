import { AsyncLocalStorage } from 'node:async_hooks';
import { createWriteStream, type WriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export type LogLevel = 'debug' | 'verbose' | 'info' | 'warn' | 'error' | 'success';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  verbose: 15,
  info: 20,
  success: 25,
  warn: 30,
  error: 40,
};

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: '\u001b[90m',
  verbose: '\u001b[94m',
  info: '\u001b[36m',
  success: '\u001b[32m',
  warn: '\u001b[33m',
  error: '\u001b[31m',
};

const COLOR_RESET = '\u001b[0m';

function shouldEmit(level: LogLevel, minimum: LogLevel) {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minimum];
}

function formatTimestamp(date = new Date()) {
  return date.toISOString();
}

function formatLine(level: LogLevel, scope: string | undefined, message: string) {
  const parts = [`[${formatTimestamp()}]`, `[${level.toUpperCase()}]`];
  if (scope) {
    parts.push(`[${scope}]`);
  }
  parts.push(message);
  return parts.join(' ');
}

interface LoggerSink {
  consoleMinLevel: LogLevel;
  fileMinLevel: LogLevel;
  stream: WriteStream | null;
}

export interface SimulationLoggerOptions {
  scope?: string;
  logFilePath?: string;
  consoleMinLevel?: LogLevel;
  fileMinLevel?: LogLevel;
}

export class SimulationLogger {
  private readonly sink: LoggerSink;
  private readonly scope?: string;

  constructor(sink: LoggerSink, scope?: string) {
    this.sink = sink;
    this.scope = scope;
  }

  child(scope: string) {
    const nextScope = this.scope ? `${this.scope}/${scope}` : scope;
    return new SimulationLogger(this.sink, nextScope);
  }

  debug(message: string) {
    this.log('debug', message);
  }

  verbose(message: string) {
    this.log('verbose', message);
  }

  info(message: string) {
    this.log('info', message);
  }

  success(message: string) {
    this.log('success', message);
  }

  warn(message: string) {
    this.log('warn', message);
  }

  error(message: string) {
    this.log('error', message);
  }

  log(level: LogLevel, message: string) {
    const line = formatLine(level, this.scope, message);
    if (shouldEmit(level, this.sink.consoleMinLevel)) {
      const colored = `${LEVEL_COLOR[level]}${line}${COLOR_RESET}`;
      if (level === 'warn' || level === 'error') {
        console.error(colored);
      } else {
        console.log(colored);
      }
    }
    if (this.sink.stream && shouldEmit(level, this.sink.fileMinLevel)) {
      this.sink.stream.write(`${line}\n`);
    }
  }

  async close() {
    if (!this.sink.stream) {
      return;
    }
    const stream = this.sink.stream;
    this.sink.stream = null;
    await new Promise<void>((resolve, reject) => {
      stream.end(() => resolve());
      stream.once('error', reject);
    });
  }
}

const storage = new AsyncLocalStorage<SimulationLogger>();
const fallbackLogger = new SimulationLogger({
  consoleMinLevel: 'info',
  fileMinLevel: 'error',
  stream: null,
});

export async function createSimulationLogger(options: SimulationLoggerOptions = {}) {
  let stream: WriteStream | null = null;
  if (options.logFilePath) {
    await mkdir(dirname(options.logFilePath), { recursive: true });
    stream = createWriteStream(options.logFilePath, { flags: 'a', encoding: 'utf8' });
  }
  return new SimulationLogger({
    consoleMinLevel: options.consoleMinLevel ?? 'info',
    fileMinLevel: options.fileMinLevel ?? 'debug',
    stream,
  }, options.scope);
}

export function withSimulationLogger<T>(logger: SimulationLogger, fn: () => T): T {
  return storage.run(logger, fn);
}

export function getSimulationLogger() {
  return storage.getStore() ?? fallbackLogger;
}

export function getActiveSimulationLogger() {
  return storage.getStore() ?? null;
}

export function logDebug(message: string) {
  getSimulationLogger().debug(message);
}

export function logVerbose(message: string) {
  getSimulationLogger().verbose(message);
}

export function logInfo(message: string) {
  getSimulationLogger().info(message);
}

export function logSuccess(message: string) {
  getSimulationLogger().success(message);
}

export function logWarn(message: string) {
  getSimulationLogger().warn(message);
}

export function logError(message: string) {
  getSimulationLogger().error(message);
}
