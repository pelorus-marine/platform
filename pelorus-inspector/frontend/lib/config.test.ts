import { describe, it, expect } from 'vitest';
import { defaultConfig, createEmptyFilters, parseCanIds, parseMessageNames } from './config';

describe('config', () => {
  describe('defaultConfig', () => {
    it('should have all required properties', () => {
      expect(defaultConfig.showDbcTab).toBe(true);
      expect(defaultConfig.showLiveTab).toBe(true);
      expect(defaultConfig.showMdf4Tab).toBe(true);
      expect(defaultConfig.initialTab).toBe('dbc');
      expect(defaultConfig.autoScroll).toBe(true);
      expect(defaultConfig.maxFrames).toBe(10000);
      expect(defaultConfig.maxSignals).toBe(10000);
    });
  });

  describe('createEmptyFilters', () => {
    it('should create filters with null values', () => {
      const filters = createEmptyFilters();
      expect(filters.timeMin).toBeNull();
      expect(filters.timeMax).toBeNull();
      expect(filters.canIds).toBeNull();
      expect(filters.messages).toBeNull();
    });

    it('should create a new object each time', () => {
      const filters1 = createEmptyFilters();
      const filters2 = createEmptyFilters();
      expect(filters1).not.toBe(filters2);
    });
  });

  describe('parseCanIds', () => {
    it('should parse single hex CAN ID', () => {
      expect(parseCanIds('7DF')).toEqual([0x7DF]);
    });

    it('should parse multiple hex CAN IDs', () => {
      expect(parseCanIds('7DF, 7E8')).toEqual([0x7DF, 0x7E8]);
    });

    it('should handle lowercase hex', () => {
      expect(parseCanIds('7df, 7e8')).toEqual([0x7DF, 0x7E8]);
    });

    it('should handle mixed case', () => {
      expect(parseCanIds('7Df, 7E8')).toEqual([0x7DF, 0x7E8]);
    });

    it('should filter out invalid hex values', () => {
      expect(parseCanIds('7DF, invalid, 7E8')).toEqual([0x7DF, 0x7E8]);
    });

    it('should return null for empty input', () => {
      expect(parseCanIds('')).toBeNull();
    });

    it('should return null for whitespace-only input', () => {
      expect(parseCanIds('   ')).toBeNull();
    });

    it('should handle extra whitespace', () => {
      expect(parseCanIds('  7DF  ,  7E8  ')).toEqual([0x7DF, 0x7E8]);
    });

    it('should handle no spaces', () => {
      expect(parseCanIds('7DF,7E8,100')).toEqual([0x7DF, 0x7E8, 0x100]);
    });

    it('should return null when all values are invalid', () => {
      // Note: 'a' is valid hex (10), so we use truly invalid chars
      expect(parseCanIds('xyz, ggg')).toBeNull();
    });

    it('should parse partial hex from strings starting with hex digits', () => {
      // 'abc' parses as 0xABC = 2748, 'face' parses as 0xFACE = 64206
      expect(parseCanIds('abc, face')).toEqual([0xABC, 0xFACE]);
    });

    it('should parse extended IDs', () => {
      expect(parseCanIds('12345678')).toEqual([0x12345678]);
    });
  });

  describe('parseMessageNames', () => {
    it('should parse single message name', () => {
      expect(parseMessageNames('EngineData')).toEqual(['enginedata']);
    });

    it('should parse multiple message names', () => {
      expect(parseMessageNames('Engine, Speed, Brake')).toEqual(['engine', 'speed', 'brake']);
    });

    it('should convert to lowercase', () => {
      expect(parseMessageNames('ENGINE, SPEED')).toEqual(['engine', 'speed']);
    });

    it('should return null for empty input', () => {
      expect(parseMessageNames('')).toBeNull();
    });

    it('should return null for whitespace-only input', () => {
      expect(parseMessageNames('   ')).toBeNull();
    });

    it('should handle extra whitespace', () => {
      expect(parseMessageNames('  Engine  ,  Speed  ')).toEqual(['engine', 'speed']);
    });

    it('should filter out empty strings', () => {
      expect(parseMessageNames('Engine,,Speed')).toEqual(['engine', 'speed']);
    });

    it('should handle partial names', () => {
      expect(parseMessageNames('rpm')).toEqual(['rpm']);
    });
  });
});
