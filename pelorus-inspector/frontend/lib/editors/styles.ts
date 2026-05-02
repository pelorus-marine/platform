/**
 * Shared CSS Styles for Pro Components
 *
 * Common styles extracted to avoid duplication across components.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Form Styles
// ─────────────────────────────────────────────────────────────────────────────

export const FORM_STYLES = `
  .form-group { margin-bottom: 14px; }
  .form-label {
    display: block;
    font-size: 0.8rem;
    font-weight: 500;
    margin-bottom: 6px;
    color: var(--cv-text);
  }
  .form-input, .form-select {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--cv-border);
    border-radius: var(--cv-radius);
    background: var(--cv-bg);
    color: var(--cv-text);
    font-size: 0.85rem;
    box-sizing: border-box;
  }
  .form-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .form-checkbox input { width: auto; cursor: pointer; }
  .form-row {
    display: flex;
    gap: 12px;
  }
  .form-row .form-group { flex: 1; }
  .form-actions {
    display: flex;
    gap: 8px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--cv-border);
  }
  .form-btn {
    flex: 1;
    padding: 10px 16px;
    border: none;
    border-radius: var(--cv-radius);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
  }
  .form-btn.primary { background: var(--cv-accent); color: white; }
  .form-btn.success { background: var(--cv-success); color: white; }
  .form-btn.danger { background: var(--cv-danger); color: white; }
  .form-btn.secondary {
    background: var(--cv-bg);
    border: 1px solid var(--cv-border);
    color: var(--cv-text);
  }
  .form-hint {
    font-size: 0.75rem;
    color: var(--cv-text-dim);
    margin-top: 4px;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Detail View Styles
// ─────────────────────────────────────────────────────────────────────────────

export const DETAIL_STYLES = `
  .detail-section { margin-bottom: 20px; }
  .detail-section-title {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--cv-text-dim);
    margin-bottom: 12px;
    letter-spacing: 0.5px;
  }
  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--cv-border);
    font-size: 0.85rem;
  }
  .detail-row:last-child { border-bottom: none; }
  .detail-label { color: var(--cv-text-muted); }
  .detail-value { color: var(--cv-text); font-weight: 500; }
  .detail-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  .detail-btn {
    flex: 1;
    padding: 10px 16px;
    border: none;
    border-radius: var(--cv-radius);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
  }
  .detail-btn.primary { background: var(--cv-accent); color: white; }
  .detail-btn.secondary {
    background: var(--cv-bg);
    border: 1px solid var(--cv-border);
    color: var(--cv-text);
  }
  .detail-btn.danger { background: var(--cv-danger); color: white; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Empty State & Loading
// ─────────────────────────────────────────────────────────────────────────────

export const EMPTY_STATE_STYLES = `
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--cv-text-dim);
    text-align: center;
    padding: 32px;
  }
`;

export const LOADING_STYLES = `
  .loading-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--cv-border);
    border-top-color: var(--cv-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Toast Notifications
// ─────────────────────────────────────────────────────────────────────────────

export const TOAST_STYLES = `
  .toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: var(--cv-radius);
    color: white;
    font-size: 0.85rem;
    z-index: 1000;
    animation: toastSlideIn 0.3s ease;
  }
  .toast.success { background: var(--cv-success); }
  .toast.error { background: var(--cv-danger); }
  .toast.info { background: var(--cv-accent); }
  @keyframes toastSlideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Confirm Dialog
// ─────────────────────────────────────────────────────────────────────────────

export const CONFIRM_DIALOG_STYLES = `
  .confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .confirm-dialog {
    background: var(--cv-bg);
    border: 1px solid var(--cv-border);
    border-radius: var(--cv-radius);
    padding: 24px;
    min-width: 320px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
  .confirm-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 12px;
  }
  .confirm-message {
    font-size: 0.85rem;
    color: var(--cv-text-muted);
    margin-bottom: 20px;
  }
  .confirm-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Status Indicators
// ─────────────────────────────────────────────────────────────────────────────

export const STATUS_STYLES = `
  .cv-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--cv-text-dim);
  }
  .cv-status-dot.active { background: var(--cv-success); }
  .cv-status-dot.pulse {
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Badges
// ─────────────────────────────────────────────────────────────────────────────

export const BADGE_STYLES = `
  .type-badge {
    font-size: 0.7rem;
    padding: 2px 6px;
    border-radius: 3px;
    background: var(--cv-bg-alt);
    color: var(--cv-text-muted);
  }
  .type-badge.vcan { background: rgba(139, 92, 246, 0.2); color: #a78bfa; }
  .type-badge.physical { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
  .type-badge.slcan { background: rgba(16, 185, 129, 0.2); color: #34d399; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Action Buttons
// ─────────────────────────────────────────────────────────────────────────────

export const ACTION_BUTTON_STYLES = `
  .action-btn {
    padding: 4px 8px;
    border: 1px solid var(--cv-border);
    border-radius: var(--cv-radius);
    background: var(--cv-bg);
    color: var(--cv-text);
    font-size: 0.75rem;
    cursor: pointer;
  }
  .action-btn:hover { background: var(--cv-bg-alt); }
  .action-btn.danger:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: var(--cv-danger);
    color: var(--cv-danger);
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────

export const TAB_STYLES = `
  .form-tabs {
    display: flex;
    gap: 0;
    margin-bottom: 16px;
    border: 1px solid var(--cv-border);
    border-radius: var(--cv-radius);
    overflow: hidden;
  }
  .form-tab {
    flex: 1;
    padding: 10px 12px;
    border: none;
    background: var(--cv-bg);
    color: var(--cv-text-muted);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    border-right: 1px solid var(--cv-border);
  }
  .form-tab:last-child { border-right: none; }
  .form-tab:hover { background: var(--cv-bg-alt); }
  .form-tab.active {
    background: var(--cv-accent);
    color: white;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar Layout
// ─────────────────────────────────────────────────────────────────────────────

export const SIDEBAR_STYLES = `
  .sidebar {
    width: 240px;
    border-left: 1px solid var(--cv-border);
    background: var(--cv-bg-alt);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  .sidebar-section {
    padding: 16px;
    border-bottom: 1px solid var(--cv-border);
  }
  .sidebar-section:last-child { border-bottom: none; }
  .sidebar-title {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--cv-text-dim);
    margin-bottom: 12px;
    letter-spacing: 0.5px;
  }
  .sidebar-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
  }
  .sidebar-row:last-child { margin-bottom: 0; }
  .sidebar-label {
    font-size: 0.75rem;
    color: var(--cv-text-muted);
  }
  .sidebar-select, .sidebar-input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--cv-border);
    border-radius: var(--cv-radius);
    background: var(--cv-bg);
    color: var(--cv-text);
    font-size: 0.8rem;
  }
  .sidebar-select:disabled, .sidebar-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .sidebar-btn {
    width: 100%;
    padding: 10px 16px;
    border: none;
    border-radius: var(--cv-radius);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
  }
  .sidebar-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .sidebar-btn.start { background: var(--cv-success); color: white; }
  .sidebar-btn.stop { background: var(--cv-danger); color: white; }
  .sidebar-btn.secondary {
    background: var(--cv-bg);
    border: 1px solid var(--cv-border);
    color: var(--cv-text);
  }
  .sidebar-btn.secondary:hover:not(:disabled) { background: var(--cv-bg-alt); }
  .sidebar-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: var(--cv-bg);
    border-radius: var(--cv-radius);
    font-size: 0.8rem;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Log Container
// ─────────────────────────────────────────────────────────────────────────────

export const LOG_STYLES = `
  .log-container {
    background: var(--cv-bg-alt);
    border: 1px solid var(--cv-border);
    border-radius: var(--cv-radius);
    max-height: 300px;
    overflow-y: auto;
  }
  .log-entry {
    padding: 8px 12px;
    font-family: var(--cv-font-mono);
    font-size: 0.75rem;
    border-bottom: 1px solid var(--cv-border);
    color: var(--cv-text-muted);
  }
  .log-entry:last-child { border-bottom: none; }
  .log-entry.error { color: var(--cv-danger); }
  .log-entry.success { color: var(--cv-success); }
  .log-entry.warning { color: var(--cv-warning, #f59e0b); }
  .log-empty {
    padding: 20px;
    text-align: center;
    color: var(--cv-text-dim);
    font-size: 0.8rem;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Panel Tabs (underline style)
// ─────────────────────────────────────────────────────────────────────────────

export const PANEL_TAB_STYLES = `
  .panel-tabs {
    display: flex;
    gap: 0;
    background: var(--cv-bg-alt);
    border-bottom: 1px solid var(--cv-border);
    padding: 0 12px;
  }
  .panel-tab {
    padding: 10px 16px;
    border: none;
    background: none;
    color: var(--cv-text-muted);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: color 0.15s, border-color 0.15s;
  }
  .panel-tab:hover { color: var(--cv-text); }
  .panel-tab.active {
    color: var(--cv-accent);
    border-bottom-color: var(--cv-accent);
  }
  .panel-tab-badge {
    font-size: 0.75rem;
    color: var(--cv-text-dim);
    margin-left: 6px;
    padding: 2px 6px;
    background: var(--cv-bg);
    border-radius: 3px;
  }
  .panel-tab.active .panel-tab-badge {
    background: rgba(59, 130, 246, 0.2);
    color: var(--cv-accent);
  }
  .panel-content { flex: 1; min-height: 0; overflow: hidden; }
  .panel-pane {
    display: none;
    height: 100%;
  }
  .panel-pane.active {
    display: flex;
    flex-direction: column;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Statistics Cards
// ─────────────────────────────────────────────────────────────────────────────

export const STAT_CARD_STYLES = `
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  .stat-card {
    text-align: center;
    padding: 16px;
    background: var(--cv-bg-alt);
    border: 1px solid var(--cv-border);
    border-radius: var(--cv-radius);
  }
  .stat-value {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--cv-accent);
  }
  .stat-label {
    font-size: 0.75rem;
    color: var(--cv-text-muted);
    margin-top: 4px;
  }
  .stat-sublabel {
    font-size: 0.65rem;
    color: var(--cv-text-dim);
    margin-top: 2px;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Toast with Close Button
// ─────────────────────────────────────────────────────────────────────────────

export const TOAST_DISMISSABLE_STYLES = `
  .toast-dismissable {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 16px 12px 20px;
    border-radius: var(--cv-radius);
    font-size: 0.85rem;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    animation: toastSlideIn 0.3s ease;
    display: flex;
    align-items: center;
    gap: 12px;
    color: white;
  }
  .toast-dismissable.success { background: var(--cv-success); }
  .toast-dismissable.error { background: var(--cv-danger); }
  .toast-dismissable.info { background: var(--cv-accent); }
  .toast-text { flex: 1; }
  .toast-close {
    background: none;
    border: none;
    color: white;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0 4px;
    opacity: 0.8;
    line-height: 1;
  }
  .toast-close:hover { opacity: 1; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Code Editor Styles
// ─────────────────────────────────────────────────────────────────────────────

export const CODE_EDITOR_STYLES = `
  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--cv-bg-alt);
    border-bottom: 1px solid var(--cv-border);
  }
  .editor-actions { display: flex; gap: 8px; }
  .code-area {
    flex: 1;
    min-height: 0;
    display: flex;
    overflow: hidden;
    background: var(--cv-bg);
  }
  .line-numbers {
    padding: 12px 8px 12px 12px;
    background: var(--cv-bg-alt);
    border-right: 1px solid var(--cv-border);
    text-align: right;
    user-select: none;
    font-family: var(--cv-font-mono);
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--cv-text-dim);
    overflow: hidden;
    min-width: 40px;
  }
  .line-number { display: block; }
  .editor-wrapper {
    flex: 1;
    position: relative;
    min-height: 0;
  }
  .highlight-layer {
    position: absolute;
    inset: 0;
    margin: 0;
    padding: 12px;
    font-family: var(--cv-font-mono);
    font-size: 0.8rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow: auto;
    pointer-events: none;
    tab-size: 4;
    color: var(--cv-text);
  }
  .code-textarea {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 12px;
    background: transparent;
    border: none;
    color: transparent;
    font-family: var(--cv-font-mono);
    font-size: 0.8rem;
    line-height: 1.5;
    resize: none;
    outline: none;
    tab-size: 4;
    caret-color: var(--cv-text);
    overflow-y: auto;
    overflow-x: hidden;
    z-index: 1;
  }
  .code-textarea::placeholder { color: var(--cv-text-dim); }
  .code-textarea:disabled { opacity: 0.5; cursor: not-allowed; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Syntax Highlighting
// ─────────────────────────────────────────────────────────────────────────────

export const SYNTAX_HIGHLIGHT_STYLES = `
  .highlight-layer .kw { color: #c586c0; }
  .highlight-layer .fn { color: #dcdcaa; }
  .highlight-layer .str { color: #ce9178; }
  .highlight-layer .num { color: #b5cea8; }
  .highlight-layer .cmt { color: #6a9955; font-style: italic; }
  .highlight-layer .op { color: #569cd6; }
  .highlight-layer .bool { color: #569cd6; }
  .highlight-layer .ident { color: #9cdcfe; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Autocomplete Dropdown
// ─────────────────────────────────────────────────────────────────────────────

export const AUTOCOMPLETE_STYLES = `
  .autocomplete {
    position: fixed;
    background: var(--cv-bg-alt);
    border: 1px solid var(--cv-border);
    border-radius: var(--cv-radius);
    box-shadow: var(--pro-shadow);
    max-height: 200px;
    overflow-y: auto;
    z-index: 10000;
    min-width: 280px;
    display: none;
  }
  .autocomplete.visible { display: block; }
  .autocomplete-item {
    padding: 6px 10px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid var(--cv-border);
  }
  .autocomplete-item:last-child { border-bottom: none; }
  .autocomplete-item:hover,
  .autocomplete-item.selected {
    background: var(--cv-accent);
    color: white;
  }
  .autocomplete-label {
    font-family: var(--cv-font-mono);
    font-size: 0.8rem;
    font-weight: 500;
  }
  .autocomplete-detail {
    font-size: 0.7rem;
    color: var(--cv-text-dim);
    text-align: right;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .autocomplete-item:hover .autocomplete-detail,
  .autocomplete-item.selected .autocomplete-detail {
    color: rgba(255,255,255,0.8);
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Template List
// ─────────────────────────────────────────────────────────────────────────────

export const TEMPLATE_LIST_STYLES = `
  .templates-container {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .templates-list {
    width: 200px;
    border-right: 1px solid var(--cv-border);
    overflow-y: auto;
    background: var(--cv-bg-alt);
  }
  .template-item {
    padding: 12px 16px;
    border-bottom: 1px solid var(--cv-border);
    cursor: pointer;
    transition: background 0.15s;
  }
  .template-item:hover { background: var(--cv-bg); }
  .template-item.selected {
    background: var(--cv-accent);
    color: white;
  }
  .template-name {
    font-weight: 600;
    font-size: 0.85rem;
    margin-bottom: 4px;
  }
  .template-desc {
    font-size: 0.7rem;
    color: var(--cv-text-dim);
  }
  .template-item.selected .template-desc {
    color: rgba(255,255,255,0.8);
  }
  .template-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--cv-bg-alt);
    border-bottom: 1px solid var(--cv-border);
  }
  .preview-title { font-weight: 600; font-size: 0.85rem; }
  .preview-code {
    flex: 1;
    overflow: auto;
    padding: 16px;
    background: var(--cv-bg);
    font-family: var(--cv-font-mono);
    font-size: 0.8rem;
    line-height: 1.5;
    white-space: pre-wrap;
    color: var(--cv-text-muted);
  }
  .preview-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--cv-text-dim);
    font-size: 0.85rem;
  }
`;
