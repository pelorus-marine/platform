export {
  formatCanId,
  formatDataHex,
  formatFlags,
  formatTimestamp,
  formatSignalValue,
  extractFilename,
} from './formatters';

export { detectDlcFromFrames } from './dlc-detection';

export { deepClone, createEvent } from './helpers';

export { escapeHtml } from './html';

// Form utilities
export {
  debounce,
  isDocumentVisible,
  createVisibilityAwareInterval,
  renderSelect,
  renderCheckbox,
  renderDetailRow,
  bindSelectToState,
  bindCheckboxToState,
  bindInputToState,
  renderLogContainer,
  updateLogDisplay,
  createLogEntry,
  showToast,
  renderPanelTabs,
  bindTabSwitching,
  switchTab,
  renderStatusIndicator,
  updateStatusIndicator,
  renderStatCard,
  renderStatsGrid,
  updateStatValue,
  renderSidebarSelect,
  renderSidebarSection,
  renderConfirmDialog,
} from './forms';

export type {
  SelectOption,
  LogEntry,
  TabDefinition,
  StatCardDefinition,
} from './forms';
