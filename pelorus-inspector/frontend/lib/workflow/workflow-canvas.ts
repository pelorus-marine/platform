/**
 * Workflow Canvas Utilities
 *
 * Pure functions for canvas operations - connection rendering, port positions.
 */

import type { WorkflowConnection } from './types.js';

/** Port position in canvas coordinates */
export interface PortPosition {
  x: number;
  y: number;
}

/**
 * Calculate the position of a port dot on a node
 */
export function getPortPosition(
  shadow: ShadowRoot,
  nodeId: string,
  portIndex: number,
  isOutput: boolean
): PortPosition | null {
  const nodeEl = shadow.querySelector(`.workflow-node[data-id="${nodeId}"]`) as HTMLElement;
  if (!nodeEl) return null;

  const portType = isOutput ? 'out' : 'in';
  const portDot = nodeEl.querySelector(`.workflow-port-dot[data-port="${portType}-${portIndex}"]`) as HTMLElement;
  if (!portDot) return null;

  const nodeRect = nodeEl.getBoundingClientRect();
  const portRect = portDot.getBoundingClientRect();

  // Get node position from style (actual canvas position)
  const nodeX = parseFloat(nodeEl.style.left) || 0;
  const nodeY = parseFloat(nodeEl.style.top) || 0;

  // Calculate port center relative to node
  const portCenterX = portRect.left - nodeRect.left + portRect.width / 2;
  const portCenterY = portRect.top - nodeRect.top + portRect.height / 2;

  return {
    x: nodeX + portCenterX,
    y: nodeY + portCenterY,
  };
}

/**
 * Generate SVG path for a bezier curve connection
 */
export function generateConnectionPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string {
  const dx = Math.abs(x2 - x1);
  const controlOffset = Math.max(50, dx * 0.5);
  return `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
}

/**
 * Render all connections as SVG paths
 */
export function renderConnectionsSvg(
  shadow: ShadowRoot,
  connections: WorkflowConnection[],
  tempConnection: { fromX: number; fromY: number; toX: number; toY: number } | null,
  selectedConnectionId: string | null,
  getPortPos: (nodeId: string, portIndex: number, isOutput: boolean) => PortPosition | null
): void {
  const svg = shadow.querySelector('#connections');
  if (!svg) return;

  let paths = '';

  // Render established connections
  for (const conn of connections) {
    const fromPos = getPortPos(conn.fromNode, conn.fromOutput, true);
    const toPos = getPortPos(conn.toNode, conn.toInput, false);

    if (fromPos && toPos) {
      const path = generateConnectionPath(fromPos.x, fromPos.y, toPos.x, toPos.y);
      const isSelected = conn.id === selectedConnectionId;
      paths += `<path class="workflow-connection ${isSelected ? 'selected' : ''}" d="${path}" data-id="${conn.id}"/>`;
    }
  }

  // Render temporary connection while dragging
  if (tempConnection) {
    const { fromX, fromY, toX, toY } = tempConnection;
    const path = generateConnectionPath(fromX, fromY, toX, toY);
    paths += `<path class="workflow-connection temp" d="${path}"/>`;
  }

  svg.innerHTML = paths;
}

/**
 * Check if adding a connection would create a cycle
 */
export function wouldCreateCycle(
  connections: WorkflowConnection[],
  fromNode: string,
  toNode: string
): boolean {
  // BFS to check if toNode can reach fromNode
  const visited = new Set<string>();
  const queue = [toNode];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === fromNode) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    // Find all nodes that current connects to
    for (const conn of connections) {
      if (conn.fromNode === current) {
        queue.push(conn.toNode);
      }
    }
  }

  return false;
}

/**
 * Clamp zoom level to valid range
 */
export function clampZoom(zoom: number): number {
  return Math.max(0.25, Math.min(2, zoom));
}
