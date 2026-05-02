/**
 * TypeScript types for CAN interface configuration
 */

export enum CanInterfaceType {
  Vcan = 'Vcan',
  Physical = 'Physical',
  Slcan = 'Slcan',
  PeakUsb = 'PeakUsb',
  Unknown = 'Unknown',
}

export type InterfaceStatus =
  | 'Up'
  | 'Down'
  | { Error: string };

export interface CanInterfaceInfo {
  name: string;
  interface_type: CanInterfaceType;
  status: InterfaceStatus;
  bitrate: number | null;
  data_bitrate: number | null;
  sample_point: number | null;
  sjw: number | null;
  is_fd_capable: boolean;
  is_listen_only: boolean;
  is_loopback: boolean;
  restart_ms: number | null;
  driver: string | null;
  state: string | null;
}

export interface CanConfigOptions {
  // Timing
  bitrate: number;
  sample_point: number | null;
  sjw: number | null;
  // CAN FD
  fd_enabled: boolean;
  data_bitrate: number | null;
  dsample_point: number | null;
  // Mode flags
  loopback: boolean;
  listen_only: boolean;
  triple_sampling: boolean;
  one_shot: boolean;
  berr_reporting: boolean;
  // Error recovery
  restart_ms: number | null;
}

export interface SerialPortInfo {
  path: string;
  description: string | null;
}

// Standard CAN bitrates
export const BITRATES = [
  { value: 10000, label: '10 kbit/s' },
  { value: 20000, label: '20 kbit/s' },
  { value: 50000, label: '50 kbit/s' },
  { value: 100000, label: '100 kbit/s' },
  { value: 125000, label: '125 kbit/s' },
  { value: 250000, label: '250 kbit/s' },
  { value: 500000, label: '500 kbit/s' },
  { value: 800000, label: '800 kbit/s' },
  { value: 1000000, label: '1 Mbit/s' },
];

// CAN FD data bitrates
export const DATA_BITRATES = [
  { value: 2000000, label: '2 Mbit/s' },
  { value: 4000000, label: '4 Mbit/s' },
  { value: 5000000, label: '5 Mbit/s' },
  { value: 8000000, label: '8 Mbit/s' },
];

// Common sample points
export const SAMPLE_POINTS = [
  { value: 0.75, label: '75.0%' },
  { value: 0.80, label: '80.0%' },
  { value: 0.833, label: '83.3%' },
  { value: 0.875, label: '87.5%' },
];

// slcan speed codes (for slcand -s option)
export const SLCAN_SPEEDS = [
  { code: 0, bitrate: 10000, label: '10 kbit/s' },
  { code: 1, bitrate: 20000, label: '20 kbit/s' },
  { code: 2, bitrate: 50000, label: '50 kbit/s' },
  { code: 3, bitrate: 100000, label: '100 kbit/s' },
  { code: 4, bitrate: 125000, label: '125 kbit/s' },
  { code: 5, bitrate: 250000, label: '250 kbit/s' },
  { code: 6, bitrate: 500000, label: '500 kbit/s' },
  { code: 7, bitrate: 800000, label: '800 kbit/s' },
  { code: 8, bitrate: 1000000, label: '1 Mbit/s' },
];

export function formatBitrate(bitrate: number | null): string {
  if (bitrate === null) return '-';
  if (bitrate >= 1000000) return `${bitrate / 1000000} Mbit/s`;
  if (bitrate >= 1000) return `${bitrate / 1000} kbit/s`;
  return `${bitrate} bit/s`;
}

export function getStatusText(status: InterfaceStatus): string {
  if (status === 'Up') return 'Up';
  if (status === 'Down') return 'Down';
  if (typeof status === 'object' && 'Error' in status) return `Error: ${status.Error}`;
  return 'Unknown';
}

export function isUp(status: InterfaceStatus): boolean {
  return status === 'Up';
}

export function getTypeLabel(type: CanInterfaceType): string {
  switch (type) {
    case CanInterfaceType.Vcan: return 'Virtual';
    case CanInterfaceType.Physical: return 'Physical';
    case CanInterfaceType.Slcan: return 'Serial';
    case CanInterfaceType.PeakUsb: return 'PEAK USB';
    default: return 'Unknown';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CAN Gateway (cangw) Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CanGateway {
  /** Unique ID for this gateway rule */
  id: number;
  /** Source interface */
  src: string;
  /** Destination interface */
  dst: string;
  /** Whether this is bidirectional (has reverse rule) */
  bidirectional: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAN Filters
// ─────────────────────────────────────────────────────────────────────────────

/** Gateway filter (for cangw routing between interfaces) */
export interface CanFilter {
  /** CAN ID to match */
  can_id: number;
  /** Mask for matching (0xFFFFFFFF = exact match) */
  mask: number;
  /** Whether this is an extended ID */
  is_extended: boolean;
}

/** Socket-level BPF filter (applied at kernel level during capture) */
export interface CanBpfFilter {
  /** CAN ID to match */
  can_id: number;
  /** Mask for matching (1 bits = must match, 0 bits = don't care) */
  mask: number;
  /** Whether this is an extended (29-bit) ID */
  is_extended: boolean;
  /** If true, reject matching frames instead of accepting */
  inverted: boolean;
}

export type FilterMode = 'Pass' | 'Block';

export interface CanGatewayWithFilter {
  /** Source interface */
  src: string;
  /** Destination interface */
  dst: string;
  /** Filters to apply */
  filters: CanFilter[];
  /** Filter mode */
  mode: FilterMode;
}

/** Common CAN ID filter presets */
export const FILTER_PRESETS = [
  { name: 'All IDs', can_id: 0, mask: 0, is_extended: false },
  { name: 'Standard IDs only', can_id: 0, mask: 0x80000000, is_extended: false },
  { name: 'Extended IDs only', can_id: 0x80000000, mask: 0x80000000, is_extended: true },
  { name: 'OBD-II (0x7DF)', can_id: 0x7DF, mask: 0x7FF, is_extended: false },
  { name: 'OBD-II Responses (0x7E8-0x7EF)', can_id: 0x7E8, mask: 0x7F8, is_extended: false },
];

export function formatFilterId(filter: CanFilter): string {
  const idHex = filter.can_id.toString(16).toUpperCase();
  const padLen = filter.is_extended ? 8 : 3;
  return `0x${idHex.padStart(padLen, '0')}`;
}

export function formatFilterMask(filter: CanFilter): string {
  const maskHex = filter.mask.toString(16).toUpperCase();
  return `0x${maskHex.padStart(8, '0')}`;
}
