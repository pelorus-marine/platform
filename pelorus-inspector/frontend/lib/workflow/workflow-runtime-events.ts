/**
 * Workflow Runtime Events Bridge
 *
 * Listens to Tauri events from the Rust backend and bridges them to the
 * mitt event bus for UI components to consume.
 */

import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  events,
  type WorkflowRuntimeLogEvent,
  type WorkflowRuntimeStatusEvent,
  type WorkflowRuntimeErrorEvent,
  type WorkflowNodeExecutedEvent,
} from '../events.js';
import { emitWorkflowLog, emitWorkflowStatus } from './workflow-events.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tauri Event Names (must match Rust backend)
// ─────────────────────────────────────────────────────────────────────────────

const TAURI_EVENTS = {
  RUNTIME_LOG: 'workflow:runtime-log',
  RUNTIME_STATUS: 'workflow:runtime-status',
  RUNTIME_ERROR: 'workflow:runtime-error',
  NODE_EXECUTED: 'workflow:node-executed',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Event Listeners Registry
// ─────────────────────────────────────────────────────────────────────────────

type TauriEvent<T> = { payload: T };

let listeners: UnlistenFn[] = [];
let isSetup = false;

/**
 * Set up listeners for Tauri events from the Rust backend.
 * Call this once when the workflow panel is mounted.
 */
export async function setupWorkflowRuntimeEvents(): Promise<void> {
  if (isSetup) {
    return;
  }

  // Listen for runtime log messages
  const logListener = await listen<WorkflowRuntimeLogEvent>(
    TAURI_EVENTS.RUNTIME_LOG,
    (event: TauriEvent<WorkflowRuntimeLogEvent>) => {
      const { message, level, nodeId } = event.payload;

      // Map Rust level strings to our level type
      const logLevel = mapLogLevel(level);

      // Emit to mitt bus (for log panel)
      emitWorkflowLog(message, logLevel);

      // Also emit raw event for components that need node context
      events.emit('workflow:log', { message, level: logLevel });

      // Log to console for debugging
      if (level === 'error') {
        console.error(`[Workflow${nodeId ? ` ${nodeId}` : ''}]`, message);
      } else if (level === 'warn') {
        console.warn(`[Workflow${nodeId ? ` ${nodeId}` : ''}]`, message);
      }
    }
  );
  listeners.push(logListener);

  // Listen for runtime status updates
  const statusListener = await listen<WorkflowRuntimeStatusEvent>(
    TAURI_EVENTS.RUNTIME_STATUS,
    (event: TauriEvent<WorkflowRuntimeStatusEvent>) => {
      const { running, framesProcessed, framesWritten } = event.payload;

      // Emit running state change to mitt bus
      emitWorkflowStatus(running);

      // Emit full status for components that need all fields (no polling needed)
      events.emit('workflow:status', { running, framesProcessed, framesWritten });

      // Store latest stats for UI components to query
      latestRuntimeStats = {
        running,
        framesProcessed,
        framesWritten,
        currentNode: event.payload.currentNode,
      };
    }
  );
  listeners.push(statusListener);

  // Listen for runtime errors
  const errorListener = await listen<WorkflowRuntimeErrorEvent>(
    TAURI_EVENTS.RUNTIME_ERROR,
    (event: TauriEvent<WorkflowRuntimeErrorEvent>) => {
      const { message, nodeId, fatal } = event.payload;

      // Emit as error log
      emitWorkflowLog(message, 'error');

      // Log to console
      console.error(`[Workflow Error${nodeId ? ` at ${nodeId}` : ''}${fatal ? ' FATAL' : ''}]`, message);
    }
  );
  listeners.push(errorListener);

  // Listen for node execution events
  const nodeListener = await listen<WorkflowNodeExecutedEvent>(
    TAURI_EVENTS.NODE_EXECUTED,
    (event: TauriEvent<WorkflowNodeExecutedEvent>) => {
      const { nodeId, framesIn, framesOut } = event.payload;

      // Emit log for visibility
      emitWorkflowLog(`Node ${nodeId}: ${framesIn} in → ${framesOut} out`, 'info');
    }
  );
  listeners.push(nodeListener);

  isSetup = true;
  console.log('[WorkflowRuntime] Tauri event listeners registered');
}

/**
 * Clean up Tauri event listeners.
 * Call this when the workflow panel is unmounted.
 */
export function cleanupWorkflowRuntimeEvents(): void {
  for (const unlisten of listeners) {
    unlisten();
  }
  listeners = [];
  isSetup = false;
  console.log('[WorkflowRuntime] Tauri event listeners cleaned up');
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Stats Cache
// ─────────────────────────────────────────────────────────────────────────────

/** Latest runtime stats from Rust backend */
let latestRuntimeStats: WorkflowRuntimeStatusEvent = {
  running: false,
  framesProcessed: 0,
  framesWritten: 0,
};

/**
 * Get the latest runtime stats.
 * Use this for UI display instead of polling.
 */
export function getLatestRuntimeStats(): WorkflowRuntimeStatusEvent {
  return { ...latestRuntimeStats };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mapLogLevel(level: string): 'info' | 'warn' | 'error' | 'success' {
  switch (level) {
    case 'error':
      return 'error';
    case 'warn':
    case 'warning':
      return 'warn';
    case 'success':
      return 'success';
    default:
      return 'info';
  }
}
