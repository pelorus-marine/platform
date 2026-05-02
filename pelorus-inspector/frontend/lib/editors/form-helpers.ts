/**
 * Shared Form Rendering Helpers
 *
 * Re-exports form utilities from can-viewer's shared utils.
 * Pro-specific extensions can be added below.
 */

// Re-export everything from can-viewer's form utilities
export {
  // Generic utilities
  debounce,
  isDocumentVisible,
  createVisibilityAwareInterval,
  escapeHtml,
  // Form rendering
  renderSelect,
  renderCheckbox,
  renderDetailRow,
  // Form binding
  bindSelectToState,
  bindCheckboxToState,
  bindInputToState,
  // Log management
  renderLogContainer,
  updateLogDisplay,
  createLogEntry,
  // Toast notifications
  showToast,
  // Tab panels
  renderPanelTabs,
  bindTabSwitching,
  switchTab,
  // Status indicators
  renderStatusIndicator,
  updateStatusIndicator,
  // Stat cards
  renderStatCard,
  renderStatsGrid,
  updateStatValue,
  // Sidebar helpers
  renderSidebarSelect,
  renderSidebarSection,
  // Confirm dialog
  renderConfirmDialog,
} from '../utils';

export type {
  SelectOption,
  LogEntry,
  TabDefinition,
  StatCardDefinition,
} from '../utils';

// ─────────────────────────────────────────────────────────────────────────────
// Pro-specific helpers
// ─────────────────────────────────────────────────────────────────────────────

// Add any Pro-specific form helpers here
