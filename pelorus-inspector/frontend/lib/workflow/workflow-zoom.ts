/**
 * Workflow Zoom & Pan
 *
 * State and handlers for canvas zoom and pan operations.
 */

export interface ZoomPanState {
  zoom: number;
  panX: number;
  panY: number;
  isPanning: boolean;
  panStartX: number;
  panStartY: number;
}

/** Create initial zoom/pan state */
export function createZoomPanState(): ZoomPanState {
  return {
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
  };
}

/** Clamp zoom level to valid range */
export function clampZoom(zoom: number): number {
  return Math.max(0.25, Math.min(2, zoom));
}

/** Apply zoom change and return new state */
export function applyZoom(state: ZoomPanState, delta: number, mouseX?: number, mouseY?: number): ZoomPanState {
  const oldZoom = state.zoom;
  const newZoom = clampZoom(state.zoom + delta);

  if (mouseX !== undefined && mouseY !== undefined) {
    // Zoom towards mouse position
    const zoomRatio = newZoom / oldZoom;
    return {
      ...state,
      zoom: newZoom,
      panX: mouseX - (mouseX - state.panX) * zoomRatio,
      panY: mouseY - (mouseY - state.panY) * zoomRatio,
    };
  }

  return { ...state, zoom: newZoom };
}

/** Reset zoom and pan to defaults */
export function resetZoomPan(): ZoomPanState {
  return createZoomPanState();
}

/** Start panning */
export function startPan(state: ZoomPanState, clientX: number, clientY: number): ZoomPanState {
  return {
    ...state,
    isPanning: true,
    panStartX: clientX - state.panX,
    panStartY: clientY - state.panY,
  };
}

/** Update pan position */
export function updatePan(state: ZoomPanState, clientX: number, clientY: number): ZoomPanState {
  if (!state.isPanning) return state;
  return {
    ...state,
    panX: clientX - state.panStartX,
    panY: clientY - state.panStartY,
  };
}

/** End panning */
export function endPan(state: ZoomPanState): ZoomPanState {
  return { ...state, isPanning: false };
}

/** Apply wheel scroll for pan */
export function applyWheelPan(state: ZoomPanState, deltaX: number, deltaY: number): ZoomPanState {
  return {
    ...state,
    panX: state.panX - deltaX,
    panY: state.panY - deltaY,
  };
}

/** Get CSS transform string for current state */
export function getTransformStyle(state: ZoomPanState): string {
  return `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
}

/** Get zoom percentage display string */
export function getZoomPercentage(state: ZoomPanState): string {
  return `${Math.round(state.zoom * 100)}%`;
}

/** Convert screen coordinates to canvas coordinates */
export function screenToCanvas(
  state: ZoomPanState,
  screenX: number,
  screenY: number,
  canvasRect: DOMRect
): { x: number; y: number } {
  const rawX = screenX - canvasRect.left;
  const rawY = screenY - canvasRect.top;
  return {
    x: (rawX - state.panX) / state.zoom,
    y: (rawY - state.panY) / state.zoom,
  };
}
