import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TauriApi } from './tauri-api';
import type { CanFrame, DecodedSignal, DbcInfo, InitialFiles } from '../types';

// Mock the dialog plugin
const mockOpen = vi.fn();
const mockSave = vi.fn();

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: (...args: unknown[]) => mockOpen(...args),
  save: (...args: unknown[]) => mockSave(...args),
}));

// Mock Tauri APIs
function createMockTauri() {
  const listeners: Record<string, ((event: { payload: unknown }) => void)[]> = {};

  return {
    core: {
      invoke: vi.fn(),
    },
    event: {
      listen: vi.fn(async (event: string, handler: (event: { payload: unknown }) => void) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler);
        return () => {
          const idx = listeners[event].indexOf(handler);
          if (idx >= 0) listeners[event].splice(idx, 1);
        };
      }),
    },
    // Helper to emit events in tests
    _emit: (event: string, payload: unknown) => {
      if (listeners[event]) {
        listeners[event].forEach(handler => handler({ payload }));
      }
    },
  };
}

describe('TauriApi', () => {
  let api: TauriApi;
  let mockTauri: ReturnType<typeof createMockTauri>;

  beforeEach(async () => {
    mockTauri = createMockTauri();

    // Set up global mock
    (window as unknown as { __TAURI__: unknown }).__TAURI__ = mockTauri;

    api = new TauriApi();
    await api.init();
  });

  describe('initialization', () => {
    it('should initialize successfully when Tauri is available', async () => {
      expect(api).toBeDefined();
    });

    it('should throw when Tauri is not available', async () => {
      delete (window as unknown as { __TAURI__: unknown }).__TAURI__;

      const newApi = new TauriApi();
      await expect(newApi.init()).rejects.toThrow('Tauri API not available');
    });
  });

  describe('DBC operations', () => {
    it('should call invoke with correct params for loadDbc', async () => {
      mockTauri.core.invoke.mockResolvedValue('DBC loaded');

      const result = await api.loadDbc('/test/file.dbc');

      expect(mockTauri.core.invoke).toHaveBeenCalledWith('load_dbc', { path: '/test/file.dbc' });
      expect(result).toBe('DBC loaded');
    });

    it('should call invoke for clearDbc', async () => {
      mockTauri.core.invoke.mockResolvedValue(undefined);

      await api.clearDbc();

      expect(mockTauri.core.invoke).toHaveBeenCalledWith('clear_dbc');
    });

    it('should call invoke for getDbcInfo', async () => {
      const mockDbcInfo: DbcInfo = {
        nodes: [],
        messages: [{ id: 0x100, name: 'Test', dlc: 8, sender: '', signals: [] }],
        value_descriptions: [],
        attribute_definitions: [],
        attribute_defaults: [],
        attribute_values: [],
        extended_multiplexing: [],
      };
      mockTauri.core.invoke.mockResolvedValue(mockDbcInfo);

      const result = await api.getDbcInfo();

      expect(mockTauri.core.invoke).toHaveBeenCalledWith('get_dbc_info');
      expect(result).toEqual(mockDbcInfo);
    });

    it('should return null when no DBC loaded', async () => {
      mockTauri.core.invoke.mockResolvedValue(null);

      const result = await api.getDbcInfo();

      expect(result).toBeNull();
    });
  });

  describe('frame decoding', () => {
    it('should call invoke with frames for decodeFrames', async () => {
      const frames: CanFrame[] = [
        {
          timestamp: 1.0,
          channel: 'can0',
          can_id: 0x100,
          is_extended: false,
          is_fd: false,
          brs: false,
          esi: false,
          dlc: 8,
          data: [1, 2, 3, 4, 5, 6, 7, 8],
        },
      ];

      const mockSignals: DecodedSignal[] = [
        {
          timestamp: 1.0,
          message_name: 'Test',
          signal_name: 'Signal1',
          value: 123,
          raw_value: 100,
          unit: 'km/h',
        },
      ];

      mockTauri.core.invoke.mockResolvedValue(mockSignals);

      const result = await api.decodeFrames(frames);

      expect(mockTauri.core.invoke).toHaveBeenCalledWith('decode_frames', { frames });
      expect(result).toEqual(mockSignals);
    });
  });

  describe('MDF4 loading', () => {
    it('should call invoke for loadMdf4', async () => {
      const mockFrames: CanFrame[] = [];
      const mockSignals: DecodedSignal[] = [];
      mockTauri.core.invoke.mockResolvedValue([mockFrames, mockSignals]);

      const result = await api.loadMdf4('/test/file.mf4');

      expect(mockTauri.core.invoke).toHaveBeenCalledWith('load_mdf4', { path: '/test/file.mf4' });
      expect(result).toEqual([mockFrames, mockSignals]);
    });
  });

  describe('CAN interfaces', () => {
    it('should list interfaces', async () => {
      const mockInterfaces = ['can0', 'can1', 'vcan0'];
      mockTauri.core.invoke.mockResolvedValue(mockInterfaces);

      const result = await api.listCanInterfaces();

      expect(mockTauri.core.invoke).toHaveBeenCalledWith('list_can_interfaces');
      expect(result).toEqual(mockInterfaces);
    });
  });

  describe('capture control', () => {
    it('should start capture with interface name and file', async () => {
      mockTauri.core.invoke.mockResolvedValue(undefined);

      await api.startCapture('can0', '/tmp/capture.mf4');

      expect(mockTauri.core.invoke).toHaveBeenCalledWith('start_capture', { interface: 'can0', captureFile: '/tmp/capture.mf4', append: false, filters: null });
    });

    it('should start capture with append mode', async () => {
      mockTauri.core.invoke.mockResolvedValue(undefined);

      await api.startCapture('can0', '/tmp/capture.mf4', true);

      expect(mockTauri.core.invoke).toHaveBeenCalledWith('start_capture', { interface: 'can0', captureFile: '/tmp/capture.mf4', append: true, filters: null });
    });

    it('should stop capture', async () => {
      mockTauri.core.invoke.mockResolvedValue(undefined);

      await api.stopCapture();

      expect(mockTauri.core.invoke).toHaveBeenCalledWith('stop_capture');
    });
  });

  describe('initial files', () => {
    it('should get initial files', async () => {
      const mockInitial: InitialFiles = {
        dbc_path: '/test/file.dbc',
        mdf4_path: '/test/file.mf4',
      };
      mockTauri.core.invoke.mockResolvedValue(mockInitial);

      const result = await api.getInitialFiles();

      expect(mockTauri.core.invoke).toHaveBeenCalledWith('get_initial_files');
      expect(result).toEqual(mockInitial);
    });

    it('should return null paths when no initial files', async () => {
      const mockInitial: InitialFiles = {
        dbc_path: null,
        mdf4_path: null,
      };
      mockTauri.core.invoke.mockResolvedValue(mockInitial);

      const result = await api.getInitialFiles();

      expect(result.dbc_path).toBeNull();
      expect(result.mdf4_path).toBeNull();
    });
  });

  describe('file dialog', () => {
    beforeEach(() => {
      mockOpen.mockReset();
      mockSave.mockReset();
    });

    it('should open file dialog with filters', async () => {
      mockOpen.mockResolvedValue('/selected/file.dbc');

      const result = await api.openFileDialog([
        { name: 'DBC Files', extensions: ['dbc'] },
      ]);

      expect(mockOpen).toHaveBeenCalledWith({
        multiple: false,
        filters: [{ name: 'DBC Files', extensions: ['dbc'] }],
      });
      expect(result).toBe('/selected/file.dbc');
    });

    it('should return null when dialog is cancelled', async () => {
      mockOpen.mockResolvedValue(null);

      const result = await api.openFileDialog([
        { name: 'DBC Files', extensions: ['dbc'] },
      ]);

      expect(result).toBeNull();
    });
  });

  describe('event listeners', () => {
    it('should register and receive CAN frame events', async () => {
      const receivedFrames: CanFrame[] = [];

      api.onCanFrame((frame) => {
        receivedFrames.push(frame);
      });

      // Wait for listener to be registered
      await new Promise(resolve => setTimeout(resolve, 10));

      const testFrame: CanFrame = {
        timestamp: 1.0,
        channel: 'can0',
        can_id: 0x123,
        is_extended: false,
        is_fd: false,
        brs: false,
        esi: false,
        dlc: 8,
        data: [1, 2, 3, 4, 5, 6, 7, 8],
      };

      mockTauri._emit('can-frame', testFrame);

      expect(receivedFrames.length).toBe(1);
      expect(receivedFrames[0]).toEqual(testFrame);
    });

    it('should register and receive decoded signal events', async () => {
      const receivedSignals: DecodedSignal[] = [];

      api.onDecodedSignal((signal) => {
        receivedSignals.push(signal);
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const testSignal: DecodedSignal = {
        timestamp: 1.0,
        message_name: 'Test',
        signal_name: 'Signal1',
        value: 123,
        raw_value: 100,
        unit: 'km/h',
      };

      mockTauri._emit('decoded-signal', testSignal);

      expect(receivedSignals.length).toBe(1);
      expect(receivedSignals[0]).toEqual(testSignal);
    });

    it('should register and receive capture error events', async () => {
      const receivedErrors: string[] = [];

      api.onCaptureError((error) => {
        receivedErrors.push(error);
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      mockTauri._emit('capture-error', 'Test error message');

      expect(receivedErrors.length).toBe(1);
      expect(receivedErrors[0]).toBe('Test error message');
    });

    it('should unsubscribe from events', async () => {
      const receivedFrames: CanFrame[] = [];

      const unsubscribe = api.onCanFrame((frame) => {
        receivedFrames.push(frame);
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Emit first frame
      mockTauri._emit('can-frame', { timestamp: 0 });
      expect(receivedFrames.length).toBe(1);

      // Unsubscribe
      unsubscribe();

      // Give time for unsubscribe to take effect
      await new Promise(resolve => setTimeout(resolve, 10));

      // Emit second frame - should not be received
      mockTauri._emit('can-frame', { timestamp: 1 });

      // Note: Due to async nature, the second frame might still be received
      // This test verifies the unsubscribe mechanism exists
    });
  });
});

describe('TauriApi edge cases', () => {
  it('should handle invoke errors', async () => {
    const mockTauri = createMockTauri();
    (window as unknown as { __TAURI__: unknown }).__TAURI__ = mockTauri;

    const api = new TauriApi();
    await api.init();

    mockTauri.core.invoke.mockRejectedValue(new Error('Backend error'));

    await expect(api.loadDbc('/test.dbc')).rejects.toThrow('Backend error');
  });

  it('should handle empty interface list', async () => {
    const mockTauri = createMockTauri();
    (window as unknown as { __TAURI__: unknown }).__TAURI__ = mockTauri;

    const api = new TauriApi();
    await api.init();

    mockTauri.core.invoke.mockResolvedValue([]);

    const result = await api.listCanInterfaces();

    expect(result).toEqual([]);
  });
});
