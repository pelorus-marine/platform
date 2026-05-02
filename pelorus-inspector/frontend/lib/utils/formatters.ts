import type { CanFrame } from '../types';

/** Format CAN ID as hex string with 0x prefix */
export function formatCanId(id: number, isExtended: boolean): string {
  const hex = isExtended
    ? id.toString(16).toUpperCase().padStart(8, '0')
    : id.toString(16).toUpperCase().padStart(3, '0');
  return `0x${hex}`;
}

/** Format data bytes as hex string with spaces */
export function formatDataHex(data: number[]): string {
  return data.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

/** Format frame flags (EXT, FD, BRS, ESI) */
export function formatFlags(frame: CanFrame): string {
  const flags: string[] = [];
  if (frame.is_extended) flags.push('EXT');
  if (frame.is_fd) flags.push('FD');
  if (frame.brs) flags.push('BRS');
  if (frame.esi) flags.push('ESI');
  return flags.join(', ') || '-';
}

/** Format timestamp with fixed precision */
export function formatTimestamp(timestamp: number, precision = 6): string {
  return timestamp.toFixed(precision);
}

/** Format signal value with fixed precision */
export function formatSignalValue(value: number, precision = 4): string {
  return value.toFixed(precision);
}

/** Extract filename from a path (handles both Unix and Windows separators) */
export function extractFilename(path: string): string {
  return path.split('/').pop()?.split('\\').pop() || path;
}
