/** CAN frame data */
export interface CanFrame {
  timestamp: number;
  channel: string;
  can_id: number;
  is_extended: boolean;
  is_fd: boolean;
  brs: boolean;
  esi: boolean;
  dlc: number;
  data: number[];
}

/** Decoded signal from DBC */
export interface DecodedSignal {
  timestamp: number;
  message_name: string;
  signal_name: string;
  value: number;
  raw_value: number;
  unit: string;
  description?: string;
}

/** Response from decode command, including any errors */
export interface DecodeResponse {
  signals: DecodedSignal[];
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Socket-level BPF Filters
// ─────────────────────────────────────────────────────────────────────────────

/** Kernel-level CAN filter (BPF) for socket filtering */
export interface CanBpfFilter {
  /** CAN ID to match */
  can_id: number;
  /** Mask for matching (1 bits = must match, 0 bits = don't care) */
  mask: number;
  /** If true, filter matches extended (29-bit) IDs */
  is_extended: boolean;
  /** If true, invert the filter (reject matching frames) */
  inverted: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Live Capture DTOs (from Rust)
// ─────────────────────────────────────────────────────────────────────────────

/** Capture statistics from Rust */
export interface CaptureStatsDto {
  frame_count: number;
  message_count: number;
  signal_count: number;
  frame_rate: number;
  elapsed_secs: number;
  capture_file: string | null;
}

/** Pre-formatted stats strings from Rust */
export interface StatsHtml {
  message_count: string;
  frame_count: string;
  frame_rate: string;
  elapsed: string;
}

/** Periodic update sent from Rust during live capture */
export interface LiveCaptureUpdate {
  stats: CaptureStatsDto;
  /** Pre-rendered HTML for message monitor table body */
  messages_html: string;
  /** Pre-rendered HTML for signal monitor container */
  signals_html: string;
  /** Pre-rendered HTML for frame stream table body */
  frames_html: string;
  /** Pre-rendered HTML for error monitor table body */
  errors_html: string;
  /** Pre-formatted stats strings */
  stats_html: StatsHtml;
  /** Badge counts */
  message_count: number;
  signal_count: number;
  frame_count: number;
  error_count: number;
}

/** Signal definition from DBC */
export interface SignalInfo {
  name: string;
  start_bit: number;
  length: number;
  byte_order: string;
  is_signed: boolean;
  factor: number;
  offset: number;
  min: number;
  max: number;
  unit: string;
  /** Comment from CM_ SG_ entry */
  comment?: string;
  /** True if this signal is a multiplexer */
  is_multiplexer?: boolean;
  /** Multiplexer value (for multiplexed signals) */
  multiplexer_value?: number | null;
}

/** Message definition from DBC */
export interface MessageInfo {
  id: number;
  name: string;
  dlc: number;
  sender: string;
  signals: SignalInfo[];
  /** Comment from CM_ BO_ entry */
  comment?: string;
}

/** Node info from DBC */
export interface NodeInfo {
  name: string;
  comment?: string;
}

/** Value description entry */
export interface ValueDescriptionEntry {
  value: number;
  description: string;
}

/** Value descriptions for a signal */
export interface SignalValueDescriptions {
  message_id: number;
  signal_name: string;
  descriptions: ValueDescriptionEntry[];
}

/** Attribute value type */
export type AttributeValueType =
  | { Int: { min: number; max: number } }
  | { Hex: { min: number; max: number } }
  | { Float: { min: number; max: number } }
  | { String: null }
  | { Enum: { values: string[] } };

/** Attribute definition */
export interface AttributeDefinitionInfo {
  name: string;
  object_type: string;
  value_type: AttributeValueType;
}

/** Attribute default */
export interface AttributeDefaultInfo {
  name: string;
  value: AttributeValueInfo;
}

/** Attribute value */
export type AttributeValueInfo =
  | { Int: number }
  | { Float: number }
  | { String: string };

/** Attribute target */
export type AttributeTargetInfo =
  | { Network: null }
  | { Node: { node_name: string } }
  | { Message: { message_id: number } }
  | { Signal: { message_id: number; signal_name: string } };

/** Attribute assignment */
export interface AttributeAssignmentInfo {
  name: string;
  target: AttributeTargetInfo;
  value: AttributeValueInfo;
}

/** Extended multiplexing info */
export interface ExtendedMultiplexingInfo {
  message_id: number;
  signal_name: string;
  multiplexer_signal: string;
  ranges: [number, number][];
}

/** Bit timing configuration (BS_ section) */
export interface BitTimingInfo {
  baudrate: number;
  btr1: number;
  btr2: number;
}

/** Full DBC structure from backend */
export interface DbcInfo {
  version?: string;
  bit_timing?: BitTimingInfo;
  comment?: string;
  nodes: NodeInfo[];
  messages: MessageInfo[];
  value_descriptions: SignalValueDescriptions[];
  attribute_definitions: AttributeDefinitionInfo[];
  attribute_defaults: AttributeDefaultInfo[];
  attribute_values: AttributeAssignmentInfo[];
  extended_multiplexing: ExtendedMultiplexingInfo[];
}

/** Initial files from CLI */
export interface InitialFiles {
  dbc_path: string | null;
  mdf4_path: string | null;
}

/** Pelorus Inspector configuration */
export interface InspectorConfig {
  /** Application name (e.g., "Pelorus Inspector" or "Pelorus Inspector Pro") */
  appName?: string;
  /** Show DBC tab */
  showDbcTab?: boolean;
  /** Show Live Capture tab */
  showLiveTab?: boolean;
  /** Show MDF4 tab */
  showMdf4Tab?: boolean;
  /** Show About tab */
  showAboutTab?: boolean;
  /** Initial active tab */
  initialTab?: 'mdf4' | 'live' | 'dbc' | 'about';
  /** Enable auto-scroll */
  autoScroll?: boolean;
  /** Maximum frames to keep in memory */
  maxFrames?: number;
  /** Maximum signals to keep in memory */
  maxSignals?: number;
}

/** Pelorus Inspector API interface - implement this for different backends */
export interface InspectorApi {
  /** Load a DBC file */
  loadDbc(path: string): Promise<string>;
  /** Clear loaded DBC */
  clearDbc(): Promise<void>;
  /** Get DBC info */
  getDbcInfo(): Promise<DbcInfo | null>;
  /** Get path to currently loaded DBC file */
  getDbcPath(): Promise<string | null>;
  /** Get the DBC file format specification markdown */
  getDbcSpecification(): Promise<string>;
  /** Decode frames using loaded DBC */
  decodeFrames(frames: CanFrame[]): Promise<DecodeResponse>;
  /** Load MDF4 file */
  loadMdf4(path: string): Promise<[CanFrame[], DecodedSignal[]]>;
  /** Export frames to MDF4 file */
  exportLogs(path: string, frames: CanFrame[]): Promise<number>;
  /** List CAN interfaces */
  listCanInterfaces(): Promise<string[]>;
  /** Start capture on interface, writing to capture file */
  startCapture(iface: string, captureFile: string, append?: boolean, filters?: CanBpfFilter[]): Promise<void>;
  /** Stop capture, returns path to finalized MDF4 file */
  stopCapture(): Promise<string>;
  /** Get initial files from CLI */
  getInitialFiles(): Promise<InitialFiles>;
  /** Save DBC content to file */
  saveDbcContent(path: string, content: string): Promise<void>;
  /** Update in-memory DBC for live decoding (does not save to file) */
  updateDbcContent(content: string): Promise<string>;
  /** Open file dialog for loading */
  openFileDialog(filters: FileFilter[]): Promise<string | null>;
  /** Open file dialog for saving */
  saveFileDialog(filters: FileFilter[], defaultName?: string): Promise<string | null>;
  /** Subscribe to CAN frame events */
  onCanFrame(callback: (frame: CanFrame) => void): () => void;
  /** Subscribe to decoded signal events */
  onDecodedSignal(callback: (signal: DecodedSignal) => void): () => void;
  /** Subscribe to decode error events (during live capture) */
  onDecodeError(callback: (error: string) => void): () => void;
  /** Subscribe to capture error events */
  onCaptureError(callback: (error: string) => void): () => void;
  /** Subscribe to live capture updates (from Rust) */
  onLiveCaptureUpdate(callback: (update: LiveCaptureUpdate) => void): () => void;
  /** Subscribe to capture finalized event (MDF4 written) */
  onCaptureFinalized(callback: (path: string) => void): () => void;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Extension System (for Pro versions)
// ─────────────────────────────────────────────────────────────────────────────

/** Extension tab configuration */
export interface ExtensionTab {
  /** Tab ID (used for data-tab attribute) */
  id: string;
  /** Tab label displayed in the tab bar */
  label: string;
  /** Optional icon (emoji or HTML) */
  icon?: string;
  /** Optional tooltip */
  title?: string;
}

/** Extension interface for pro features */
export interface InspectorExtension {
  /** Unique extension ID */
  id: string;
  /** Tab configuration (if adding a tab) */
  tab?: ExtensionTab;
  /** Toolbar component tag name (e.g., 'cv-cloud-toolbar') */
  toolbar?: string;
  /** Panel component tag name (e.g., 'cv-cloud-panel') */
  panel?: string;
  /** Called when extension is registered */
  setup?: (api: InspectorApi) => void | Promise<void>;
  /** Called when extension is unregistered */
  teardown?: () => void;
}
