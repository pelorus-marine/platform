import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialState,
  addFrame,
  addSignal,
  clearData,
  applyFiltersFromInputs,
  clearFilters,
  getMessageName,
  getFilteredFrames,
  updateFilteredFrames,
  selectFrame,
  getSelectedFrame,
  setCaptureStatus,
  setActiveTab,
  type ViewerState,
} from './state';
import { createMockFrames, createMockDbcInfo, createMockSignal } from './api';

describe('state', () => {
  let state: ViewerState;

  beforeEach(() => {
    state = createInitialState();
  });

  describe('createInitialState', () => {
    it('should create state with default config', () => {
      expect(state.frames).toEqual([]);
      expect(state.filteredFrames).toEqual([]);
      expect(state.signals).toEqual([]);
      expect(state.dbcInfo).toBeNull();
      expect(state.dbcLoaded).toBe(false);
      expect(state.isCapturing).toBe(false);
      expect(state.activeTab).toBe('dbc');
      expect(state.selectedMessageId).toBeNull();
      expect(state.selectedFrameIndex).toBeNull();
    });

    it('should merge custom config', () => {
      const customState = createInitialState({ initialTab: 'live', autoScroll: false });
      expect(customState.activeTab).toBe('live');
      expect(customState.config.autoScroll).toBe(false);
    });

    it('should preserve default config values for unspecified options', () => {
      const customState = createInitialState({ showDbcTab: false });
      expect(customState.config.showDbcTab).toBe(false);
      expect(customState.config.showLiveTab).toBe(true);
      expect(customState.config.showMdf4Tab).toBe(true);
    });
  });

  describe('addFrame', () => {
    it('should add a frame to state', () => {
      const frame = createMockFrames(1)[0];
      addFrame(state, frame);
      expect(state.frames.length).toBe(1);
      expect(state.frames[0]).toBe(frame);
    });

    it('should respect max frames limit', () => {
      state.config.maxFrames = 10;
      for (let i = 0; i < 15; i++) {
        addFrame(state, createMockFrames(1)[0]);
      }
      // After exceeding, it slices to half
      expect(state.frames.length).toBeLessThanOrEqual(10);
    });

    it('should keep most recent frames when trimming', () => {
      state.config.maxFrames = 10;
      for (let i = 0; i < 15; i++) {
        const frame = createMockFrames(1)[0];
        frame.timestamp = i;
        addFrame(state, frame);
      }
      // Should have the most recent frames
      expect(state.frames[state.frames.length - 1].timestamp).toBe(14);
    });
  });

  describe('addSignal', () => {
    it('should add a signal to state', () => {
      const signal = createMockSignal();
      addSignal(state, signal);
      expect(state.signals.length).toBe(1);
      expect(state.signals[0]).toBe(signal);
    });

    it('should respect max signals limit', () => {
      state.config.maxSignals = 10;
      for (let i = 0; i < 15; i++) {
        addSignal(state, createMockSignal());
      }
      expect(state.signals.length).toBeLessThanOrEqual(10);
    });
  });

  describe('clearData', () => {
    it('should clear all data', () => {
      state.frames = createMockFrames(5);
      state.signals = [createMockSignal()];
      state.filteredFrames = createMockFrames(3);
      state.selectedFrameIndex = 2;

      clearData(state);

      expect(state.frames).toEqual([]);
      expect(state.signals).toEqual([]);
      expect(state.filteredFrames).toEqual([]);
      expect(state.selectedFrameIndex).toBeNull();
    });
  });

  describe('applyFiltersFromInputs', () => {
    it('should parse and apply time filters', () => {
      applyFiltersFromInputs(state, '0.001', '0.005', '', '');
      expect(state.filters.timeMin).toBe(0.001);
      expect(state.filters.timeMax).toBe(0.005);
    });

    it('should parse and apply CAN ID filters', () => {
      applyFiltersFromInputs(state, '', '', '7DF, 7E8', '');
      expect(state.filters.canIds).toEqual([0x7DF, 0x7E8]);
    });

    it('should parse and apply message name filters', () => {
      applyFiltersFromInputs(state, '', '', '', 'Engine, Speed');
      expect(state.filters.messages).toEqual(['engine', 'speed']);
    });

    it('should clear selected frame index', () => {
      state.selectedFrameIndex = 5;
      applyFiltersFromInputs(state, '', '', '', '');
      expect(state.selectedFrameIndex).toBeNull();
    });

    it('should handle empty inputs', () => {
      applyFiltersFromInputs(state, '', '', '', '');
      expect(state.filters.timeMin).toBeNull();
      expect(state.filters.timeMax).toBeNull();
      expect(state.filters.canIds).toBeNull();
      expect(state.filters.messages).toBeNull();
    });
  });

  describe('clearFilters', () => {
    it('should reset all filters', () => {
      state.filters.timeMin = 1;
      state.filters.timeMax = 10;
      state.filters.canIds = [0x100];
      state.filters.messages = ['engine'];
      state.selectedFrameIndex = 3;

      clearFilters(state);

      expect(state.filters.timeMin).toBeNull();
      expect(state.filters.timeMax).toBeNull();
      expect(state.filters.canIds).toBeNull();
      expect(state.filters.messages).toBeNull();
      expect(state.selectedFrameIndex).toBeNull();
    });
  });

  describe('getMessageName', () => {
    it('should return message name from DBC info', () => {
      state.dbcInfo = createMockDbcInfo();
      expect(getMessageName(state, 0x100)).toBe('EngineData');
    });

    it('should return dash when DBC not loaded', () => {
      expect(getMessageName(state, 0x100)).toBe('-');
    });

    it('should return dash when message not found', () => {
      state.dbcInfo = createMockDbcInfo();
      expect(getMessageName(state, 0x999)).toBe('-');
    });
  });

  describe('getFilteredFrames', () => {
    beforeEach(() => {
      state.frames = createMockFrames(10);
      state.dbcInfo = createMockDbcInfo();
    });

    it('should return all frames when no filters', () => {
      const filtered = getFilteredFrames(state);
      expect(filtered.length).toBe(10);
    });

    it('should filter by time min', () => {
      state.filters.timeMin = 0.005;
      const filtered = getFilteredFrames(state);
      expect(filtered.every(f => f.timestamp >= 0.005)).toBe(true);
    });

    it('should filter by time max', () => {
      state.filters.timeMax = 0.005;
      const filtered = getFilteredFrames(state);
      expect(filtered.every(f => f.timestamp <= 0.005)).toBe(true);
    });

    it('should filter by time range', () => {
      state.filters.timeMin = 0.003;
      state.filters.timeMax = 0.006;
      const filtered = getFilteredFrames(state);
      expect(filtered.length).toBe(4); // 0.003, 0.004, 0.005, 0.006
    });

    it('should filter by CAN IDs', () => {
      state.filters.canIds = [0x100];
      const filtered = getFilteredFrames(state);
      expect(filtered.every(f => f.can_id === 0x100)).toBe(true);
    });

    it('should filter by message names', () => {
      state.filters.messages = ['engine'];
      const filtered = getFilteredFrames(state);
      // Only frames with CAN ID 0x100 (EngineData) should match
      expect(filtered.every(f => f.can_id === 0x100)).toBe(true);
    });
  });

  describe('updateFilteredFrames', () => {
    it('should update filteredFrames cache', () => {
      state.frames = createMockFrames(5);
      updateFilteredFrames(state);
      expect(state.filteredFrames.length).toBe(5);
    });
  });

  describe('selectFrame', () => {
    it('should set selected frame index', () => {
      selectFrame(state, 3);
      expect(state.selectedFrameIndex).toBe(3);
    });
  });

  describe('getSelectedFrame', () => {
    it('should return selected frame', () => {
      state.filteredFrames = createMockFrames(5);
      state.selectedFrameIndex = 2;
      const frame = getSelectedFrame(state);
      expect(frame).toBe(state.filteredFrames[2]);
    });

    it('should return null when no selection', () => {
      expect(getSelectedFrame(state)).toBeNull();
    });

    it('should return null when index out of bounds', () => {
      state.filteredFrames = createMockFrames(3);
      state.selectedFrameIndex = 10;
      expect(getSelectedFrame(state)).toBeNull();
    });
  });

  describe('setCaptureStatus', () => {
    it('should set capture status', () => {
      setCaptureStatus(state, true);
      expect(state.isCapturing).toBe(true);
      setCaptureStatus(state, false);
      expect(state.isCapturing).toBe(false);
    });
  });

  describe('setActiveTab', () => {
    it('should set active tab', () => {
      setActiveTab(state, 'live');
      expect(state.activeTab).toBe('live');
    });
  });
});
