/**
 * Workflow Event Helpers
 *
 * Convenience functions for emitting workflow events.
 * Centralizes event emission logic and provides type-safe APIs.
 */

import {
  events,
  EMPTY_PAYLOAD,
  type WorkflowNodeInfo,
  type WorkflowConnectionInfo,
  type WorkflowNodeSelectedEvent,
  type WorkflowNodeAddedEvent,
  type WorkflowNodeDeletedEvent,
  type WorkflowNodeMovedEvent,
  type WorkflowNodeConfigChangedEvent,
  type WorkflowConnectionAddedEvent,
  type WorkflowConnectionDeletedEvent,
  type WorkflowLogEvent,
  type WorkflowClearedEvent,
  type WorkflowLoadedEvent,
  type WorkflowSavedEvent,
  type WorkflowScriptModalEvent,
  type WorkflowZoomChangedEvent,
  type WorkflowStatusEvent,
} from '../events';
import type { WorkflowNode, WorkflowConnection } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Node Info Conversion
// ─────────────────────────────────────────────────────────────────────────────

/** Convert WorkflowNode to WorkflowNodeInfo for events */
export function toNodeInfo(node: WorkflowNode): WorkflowNodeInfo {
  return {
    id: node.id,
    type: node.type,
    label: node.label,
    config: { ...node.config },
  };
}

/** Convert WorkflowConnection to WorkflowConnectionInfo for events */
export function toConnectionInfo(conn: WorkflowConnection): WorkflowConnectionInfo {
  return {
    id: conn.id,
    fromNode: conn.fromNode,
    fromOutput: conn.fromOutput,
    toNode: conn.toNode,
    toInput: conn.toInput,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Emitters
// ─────────────────────────────────────────────────────────────────────────────

/** Emit node selected event */
export function emitNodeSelected(node: WorkflowNode | null): void {
  const payload: WorkflowNodeSelectedEvent = {
    nodeId: node?.id ?? null,
    node: node ? toNodeInfo(node) : null,
  };
  events.emit('workflow:node-selected', payload);
}

/** Emit node added event */
export function emitNodeAdded(node: WorkflowNode): void {
  const payload: WorkflowNodeAddedEvent = {
    node: toNodeInfo(node),
  };
  events.emit('workflow:node-added', payload);
}

/** Emit node deleted event */
export function emitNodeDeleted(nodeId: string): void {
  const payload: WorkflowNodeDeletedEvent = { nodeId };
  events.emit('workflow:node-deleted', payload);
}

/** Emit node moved event */
export function emitNodeMoved(nodeId: string, x: number, y: number): void {
  const payload: WorkflowNodeMovedEvent = { nodeId, x, y };
  events.emit('workflow:node-moved', payload);
}

/** Emit node config changed event */
export function emitNodeConfigChanged(
  nodeId: string,
  field: string,
  value: unknown,
  config: Record<string, unknown>
): void {
  const payload: WorkflowNodeConfigChangedEvent = {
    nodeId,
    field,
    value,
    config: { ...config },
  };
  events.emit('workflow:node-config-changed', payload);
}

/** Emit connection added event */
export function emitConnectionAdded(conn: WorkflowConnection): void {
  const payload: WorkflowConnectionAddedEvent = {
    connection: toConnectionInfo(conn),
  };
  events.emit('workflow:connection-added', payload);
}

/** Emit connection deleted event */
export function emitConnectionDeleted(connectionId: string): void {
  const payload: WorkflowConnectionDeletedEvent = { connectionId };
  events.emit('workflow:connection-deleted', payload);
}

/** Emit workflow log event */
export function emitWorkflowLog(
  message: string,
  level: WorkflowLogEvent['level'] = 'info'
): void {
  const payload: WorkflowLogEvent = { message, level };
  events.emit('workflow:log', payload);
}

/** Emit workflow cleared event */
export function emitWorkflowCleared(): void {
  events.emit('workflow:cleared', EMPTY_PAYLOAD);
}

/** Emit workflow loaded event */
export function emitWorkflowLoaded(
  name: string,
  nodeCount: number,
  connectionCount: number
): void {
  const payload: WorkflowLoadedEvent = { name, nodeCount, connectionCount };
  events.emit('workflow:loaded', payload);
}

/** Emit workflow saved event */
export function emitWorkflowSaved(name: string, path: string): void {
  const payload: WorkflowSavedEvent = { name, path };
  events.emit('workflow:saved', payload);
}

/** Emit script modal event */
export function emitScriptModal(open: boolean, nodeId: string | null): void {
  const payload: WorkflowScriptModalEvent = { open, nodeId };
  events.emit('workflow:script-modal', payload);
}

/** Emit zoom changed event */
export function emitZoomChanged(zoom: number, panX: number, panY: number): void {
  const payload: WorkflowZoomChangedEvent = { zoom, panX, panY };
  events.emit('workflow:zoom-changed', payload);
}

/** Emit workflow status event */
export function emitWorkflowStatus(running: boolean, framesProcessed = 0, framesWritten = 0): void {
  const payload: WorkflowStatusEvent = { running, framesProcessed, framesWritten };
  events.emit('workflow:status', payload);
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Listeners (Convenience wrappers)
// ─────────────────────────────────────────────────────────────────────────────

type Handler<T> = (event: T) => void;

/** Subscribe to node selected events */
export function onNodeSelected(handler: Handler<WorkflowNodeSelectedEvent>): () => void {
  events.on('workflow:node-selected', handler);
  return () => events.off('workflow:node-selected', handler);
}

/** Subscribe to node added events */
export function onNodeAdded(handler: Handler<WorkflowNodeAddedEvent>): () => void {
  events.on('workflow:node-added', handler);
  return () => events.off('workflow:node-added', handler);
}

/** Subscribe to node deleted events */
export function onNodeDeleted(handler: Handler<WorkflowNodeDeletedEvent>): () => void {
  events.on('workflow:node-deleted', handler);
  return () => events.off('workflow:node-deleted', handler);
}

/** Subscribe to node config changed events */
export function onNodeConfigChanged(handler: Handler<WorkflowNodeConfigChangedEvent>): () => void {
  events.on('workflow:node-config-changed', handler);
  return () => events.off('workflow:node-config-changed', handler);
}

/** Subscribe to connection added events */
export function onConnectionAdded(handler: Handler<WorkflowConnectionAddedEvent>): () => void {
  events.on('workflow:connection-added', handler);
  return () => events.off('workflow:connection-added', handler);
}

/** Subscribe to connection deleted events */
export function onConnectionDeleted(handler: Handler<WorkflowConnectionDeletedEvent>): () => void {
  events.on('workflow:connection-deleted', handler);
  return () => events.off('workflow:connection-deleted', handler);
}

/** Subscribe to workflow log events */
export function onWorkflowLog(handler: Handler<WorkflowLogEvent>): () => void {
  events.on('workflow:log', handler);
  return () => events.off('workflow:log', handler);
}

/** Subscribe to workflow status events */
export function onWorkflowStatus(handler: Handler<WorkflowStatusEvent>): () => void {
  events.on('workflow:status', handler);
  return () => events.off('workflow:status', handler);
}

/** Subscribe to workflow loaded events */
export function onWorkflowLoaded(handler: Handler<WorkflowLoadedEvent>): () => void {
  events.on('workflow:loaded', handler);
  return () => events.off('workflow:loaded', handler);
}

/** Subscribe to workflow cleared events */
export function onWorkflowCleared(handler: Handler<WorkflowClearedEvent>): () => void {
  events.on('workflow:cleared', handler);
  return () => events.off('workflow:cleared', handler);
}

/** Subscribe to script modal events */
export function onScriptModal(handler: Handler<WorkflowScriptModalEvent>): () => void {
  events.on('workflow:script-modal', handler);
  return () => events.off('workflow:script-modal', handler);
}

/** Subscribe to zoom changed events */
export function onZoomChanged(handler: Handler<WorkflowZoomChangedEvent>): () => void {
  events.on('workflow:zoom-changed', handler);
  return () => events.off('workflow:zoom-changed', handler);
}
