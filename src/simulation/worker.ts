import { parentPort, workerData } from 'node:worker_threads';
import { executeRunChunk } from './autoplayEngine.ts';
import type { WorkerErrorMessage, WorkerProgressMessage, WorkerRunChunk } from './types.ts';

const port = parentPort;

if (!port) {
  throw new Error('Simulation worker requires an active parent port.');
}

const chunk = workerData as WorkerRunChunk;

try {
  const result = await executeRunChunk(chunk, (completed, total) => {
    const progressMessage: WorkerProgressMessage = {
      type: 'progress',
      workerId: chunk.workerId,
      completed,
      total,
    };
    port.postMessage(progressMessage);
  });

  port.postMessage(result);
} catch (error) {
  const err = error as Error;
  const message: WorkerErrorMessage = {
    type: 'error',
    workerId: chunk.workerId,
    message: err.message,
    stack: err.stack,
  };

  port.postMessage(message);
  throw error;
}
