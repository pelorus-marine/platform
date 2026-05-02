import { describe, it, expect } from 'vitest';
import { formatCanId, formatDataHex, formatFlags, formatTimestamp, formatSignalValue } from './formatters';
import type { CanFrame } from '../types';

describe('formatters', () => {
  describe('formatCanId', () => {
    it('should format standard ID with 0x prefix and 3 hex digits', () => {
      expect(formatCanId(0x1A3, false)).toBe('0x1A3');
    });

    it('should format extended ID with 0x prefix and 8 hex digits', () => {
      expect(formatCanId(0x12345678, true)).toBe('0x12345678');
    });

    it('should pad small standard IDs', () => {
      expect(formatCanId(0x01, false)).toBe('0x001');
    });

    it('should pad small extended IDs', () => {
      expect(formatCanId(0x01, true)).toBe('0x00000001');
    });

    it('should handle zero ID', () => {
      expect(formatCanId(0, false)).toBe('0x000');
      expect(formatCanId(0, true)).toBe('0x00000000');
    });

    it('should handle max standard ID (11-bit)', () => {
      expect(formatCanId(0x7FF, false)).toBe('0x7FF');
    });

    it('should handle max extended ID (29-bit)', () => {
      expect(formatCanId(0x1FFFFFFF, true)).toBe('0x1FFFFFFF');
    });
  });

  describe('formatDataHex', () => {
    it('should format data bytes as hex string with spaces', () => {
      expect(formatDataHex([0x01, 0x0A, 0xFF, 0x10])).toBe('01 0A FF 10');
    });

    it('should handle empty data', () => {
      expect(formatDataHex([])).toBe('');
    });

    it('should handle single byte', () => {
      expect(formatDataHex([0xAB])).toBe('AB');
    });

    it('should pad single digit values', () => {
      expect(formatDataHex([0x01, 0x02, 0x03])).toBe('01 02 03');
    });

    it('should handle full 8-byte CAN data', () => {
      expect(formatDataHex([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77]))
        .toBe('00 11 22 33 44 55 66 77');
    });

    it('should handle CAN FD 64-byte data', () => {
      const data = Array.from({ length: 64 }, (_, i) => i);
      const result = formatDataHex(data);
      expect(result.split(' ').length).toBe(64);
    });
  });

  describe('formatFlags', () => {
    const createFrame = (overrides: Partial<CanFrame> = {}): CanFrame => ({
      timestamp: 0,
      channel: 'can0',
      can_id: 0x100,
      is_extended: false,
      is_fd: false,
      brs: false,
      esi: false,
      dlc: 8,
      data: [1, 2, 3, 4, 5, 6, 7, 8],
      ...overrides,
    });

    it('should show EXT for extended frames', () => {
      expect(formatFlags(createFrame({ is_extended: true }))).toBe('EXT');
    });

    it('should show dash for standard data frames', () => {
      expect(formatFlags(createFrame())).toBe('-');
    });

    it('should show FD for CAN FD frames', () => {
      expect(formatFlags(createFrame({ is_fd: true }))).toBe('FD');
    });

    it('should show BRS for bit rate switch frames', () => {
      expect(formatFlags(createFrame({ is_fd: true, brs: true }))).toBe('FD, BRS');
    });

    it('should show ESI for error state indicator frames', () => {
      expect(formatFlags(createFrame({ is_fd: true, esi: true }))).toBe('FD, ESI');
    });

    it('should show all CAN FD flags when applicable', () => {
      expect(formatFlags(createFrame({ is_fd: true, brs: true, esi: true }))).toBe('FD, BRS, ESI');
    });

    it('should show all flags combined', () => {
      expect(formatFlags(createFrame({
        is_extended: true,
        is_fd: true,
        brs: true,
        esi: true,
      }))).toBe('EXT, FD, BRS, ESI');
    });
  });

  describe('formatTimestamp', () => {
    it('should format with default 6 decimal places', () => {
      expect(formatTimestamp(1.234567)).toBe('1.234567');
    });

    it('should format with custom precision', () => {
      expect(formatTimestamp(1.234567, 3)).toBe('1.235');
    });

    it('should pad with zeros', () => {
      expect(formatTimestamp(1.5)).toBe('1.500000');
    });

    it('should handle zero', () => {
      expect(formatTimestamp(0)).toBe('0.000000');
    });

    it('should handle large timestamps', () => {
      expect(formatTimestamp(999999.123456)).toBe('999999.123456');
    });
  });

  describe('formatSignalValue', () => {
    it('should format with default 4 decimal places', () => {
      expect(formatSignalValue(123.456789)).toBe('123.4568');
    });

    it('should format with custom precision', () => {
      expect(formatSignalValue(123.456789, 2)).toBe('123.46');
    });

    it('should pad with zeros', () => {
      expect(formatSignalValue(100)).toBe('100.0000');
    });

    it('should handle negative values', () => {
      expect(formatSignalValue(-45.67)).toBe('-45.6700');
    });

    it('should handle very small values', () => {
      expect(formatSignalValue(0.0001)).toBe('0.0001');
    });
  });
});
