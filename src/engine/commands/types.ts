export const BUILT_IN_CORE_COMMANDS = {
  action: 'ACTION',
  queueAction: 'QUEUE_ACTION',
  removeQueuedAction: 'REMOVE_QUEUED_ACTION',
  reorderQueuedAction: 'REORDER_QUEUED_ACTION',
  setReady: 'SET_READY',
  runSystem: 'RUN_SYSTEM',
  resolveQueue: 'RESOLVE_QUEUE',
  advancePhase: 'ADVANCE_PHASE',
  loadState: 'LOAD_STATE',
} as const;
