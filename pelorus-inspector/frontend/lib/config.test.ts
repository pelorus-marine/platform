import { describe, it, expect } from 'vitest';
import {
  defaultConfig,
  createEmptyFilterConfig,
  parseCanIds,
  parseNames,
} from './config';

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

  describe('createEmptyFilterConfig', () => {
    it('should use empty arrays and null scalar bounds', () => {
      const filters = createEmptyFilterConfig();
      expect(filters.timeMin).toBeNull();
      expect(filters.timeMax).toBeNull();
      expect(filters.canIds).toEqual([]);
      expect(filters.messages).toEqual([]);
      expect(filters.signals).toEqual([]);
      expect(filters.matchStatus).toBe('all');
    });

    it('should create a new object each time', () => {
      const filters1 = createEmptyFilterConfig();
      const filters2 = createEmptyFilterConfig();
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

    it('should filter out invalid hex values', () => {
      expect(parseCanIds('7DF, invalid, 7E8')).toEqual([0x7DF, 0x7E8]);
    });

    it('should return empty array for empty input', () => {
      expect(parseCanIds('')).toEqual([]);
    });

    it('should return empty array when all tokens are invalid', () => {
      expect(parseCanIds('xyz, ggg')).toEqual([]);
    });
  });

  describe('parseNames', () => {
    it('should lowercase and trim names', () => {
      expect(parseNames('EngineData')).toEqual(['enginedata']);
      expect(parseNames('Engine, Speed, Brake')).toEqual(['engine', 'speed', 'brake']);
    });

    it('should return empty array for blank input', () => {
      expect(parseNames('')).toEqual([]);
      expect(parseNames('   ')).toEqual([]);
    });
  });
});
