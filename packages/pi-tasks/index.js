import { registerTaskCommands } from './src/commands.js';
import {
  ORIGINOS_PI_TASKS_VERSION,
  PI_TASK_EVENT_VERSION,
  PI_TASK_PUBLIC_API_VERSION,
  PI_TASK_SCHEMA_FINGERPRINT,
  PI_TASK_STATE_EVENT_VERSION,
  PI_TASKS_UPSTREAM_ENTRY_SHA256,
  PI_TASKS_UPSTREAM_REDUCER_SHA256,
  UPSTREAM_PI_TASKS_VERSION,
} from './src/contracts.js';
import { buildTaskResume } from './src/render.js';
import { TASK_STATE_EVENT, TASK_WIDGET_ID } from './src/state-events.js';
import { createTaskRuntimeStore, snapshotState } from './src/store.js';
import { registerTaskTools } from './src/tools.js';
import { updateTaskUi } from './src/widget.js';

export {
  ORIGINOS_PI_TASKS_VERSION,
  PI_TASK_EVENT_VERSION,
  PI_TASK_PUBLIC_API_VERSION,
  PI_TASK_SCHEMA_FINGERPRINT,
  PI_TASK_STATE_EVENT_VERSION,
  PI_TASKS_UPSTREAM_ENTRY_SHA256,
  PI_TASKS_UPSTREAM_REDUCER_SHA256,
  TASK_STATE_EVENT,
  TASK_WIDGET_ID,
  UPSTREAM_PI_TASKS_VERSION,
};
export { createTaskRuntimeStore, replayBranchEntries, snapshotState } from './src/store.js';

export default function originosPiTasks(pi) {
  const store = createTaskRuntimeStore();
  const replay = (ctx, reason) => {
    const result = store.replay(ctx.sessionManager.getBranch());
    updateTaskUi(pi, ctx, result.state, reason);
    if (result.malformedEvents.length > 0) {
      ctx.ui.notify(
        `pi-tasks skipped ${result.malformedEvents.length} malformed event(s)`,
        'warning',
      );
    }
  };

  pi.on('session_start', async (_event, ctx) => replay(ctx, 'session_start'));
  pi.on('session_tree', async (_event, ctx) => replay(ctx, 'session_tree'));
  pi.on('session_before_compact', async (_event, ctx) => {
    const state = store.getState();
    if (Object.keys(state.tasks).length === 0) return;
    const createdAt = new Date().toISOString();
    const event = {
      version: 1,
      id: `snapshot-${createdAt}`,
      type: 'task.snapshot',
      taskId: state.activeTaskId ?? 'snapshot',
      createdAt,
      source: 'system',
      state: snapshotState(state),
      resume: buildTaskResume(state),
      reason: 'compaction',
    };
    const next = store.append(event, (customType, data) => {
      pi.appendEntry(customType, data);
    });
    updateTaskUi(pi, ctx, next, 'task_mutation');
  });

  registerTaskTools(pi, store);
  registerTaskCommands(pi, store);
}
