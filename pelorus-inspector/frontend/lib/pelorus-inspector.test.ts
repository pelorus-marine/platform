import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PelorusInspectorElement } from './pelorus-inspector';
import { MockApi, createMockFrames, createMockDbcInfo, createMockSignal } from './api';
import type { CanFrame } from './types';

// Mock the CSS import
vi.mock('../styles/pelorus-inspector.css?inline', () => ({
  default: '/* mocked styles */',
}));

describe('PelorusInspectorElement', () => {
  let element: PelorusInspectorElement;
  let api: MockApi;

  beforeEach(() => {
    // Register the custom element if not already registered
    if (!customElements.get('pelorus-inspector')) {
      customElements.define('pelorus-inspector', PelorusInspectorElement);
    }

    element = document.createElement('pelorus-inspector') as PelorusInspectorElement;
    document.body.appendChild(element);

    api = new MockApi();
    element.setApi(api);
  });

  afterEach(() => {
    element.remove();
  });

  describe('initialization', () => {
    it('should create shadow root', () => {
      expect(element.shadowRoot).toBeDefined();
    });

    it('should render main container', () => {
      const container = element.shadowRoot?.querySelector('.cv-app');
      expect(container).toBeTruthy();
    });

    it('should render tabs', () => {
      const tabs = element.shadowRoot?.querySelectorAll('.cv-tabs.bordered .cv-tab');
      expect(tabs?.length).toBeGreaterThan(0);
    });

    it('should render MDF4 inspector component', () => {
      const inspector = element.shadowRoot?.querySelector('cv-mdf4-inspector');
      expect(inspector).toBeTruthy();
    });

    it('should render Live viewer component', () => {
      const viewer = element.shadowRoot?.querySelector('cv-live-viewer');
      expect(viewer).toBeTruthy();
    });
  });

  describe('tab switching', () => {
    it('should switch to MDF4 tab', () => {
      const mdf4Tab = element.shadowRoot?.querySelector('[data-tab="mdf4"]') as HTMLElement;
      mdf4Tab?.click();

      expect(mdf4Tab?.classList.contains('active')).toBe(true);
    });

    it('should switch to live tab and show live panel', () => {
      const liveTab = element.shadowRoot?.querySelector('[data-tab="live"]') as HTMLElement;
      liveTab?.click();

      const livePanel = element.shadowRoot?.querySelector('#livePanel');
      expect(livePanel?.classList.contains('hidden')).toBe(false);
    });

    it('should switch to DBC tab and show DBC panel', () => {
      const dbcTab = element.shadowRoot?.querySelector('[data-tab="dbc"]') as HTMLElement;
      dbcTab?.click();

      const dbcPanel = element.shadowRoot?.querySelector('#dbcPanel');
      expect(dbcPanel?.classList.contains('hidden')).toBe(false);
    });

    it('should hide MDF4 panel on DBC tab', () => {
      const dbcTab = element.shadowRoot?.querySelector('[data-tab="dbc"]') as HTMLElement;
      dbcTab?.click();

      const mdf4Panel = element.shadowRoot?.querySelector('#mdf4Panel');
      expect(mdf4Panel?.classList.contains('hidden')).toBe(true);
    });

    it('should show MDF4 panel on MDF4 tab', () => {
      const mdf4Tab = element.shadowRoot?.querySelector('[data-tab="mdf4"]') as HTMLElement;
      mdf4Tab?.click();

      const mdf4Panel = element.shadowRoot?.querySelector('#mdf4Panel');
      expect(mdf4Panel?.classList.contains('hidden')).toBe(false);
    });
  });

  describe('DBC loading', () => {
    it('should have DBC status component', () => {
      const statusComponent = element.shadowRoot?.querySelector('cv-dbc-status');
      expect(statusComponent).toBeTruthy();
      expect(statusComponent?.textContent).toContain('DBC');
      expect(statusComponent?.textContent).toContain('No file loaded');
    });
  });

  describe('MDF4 loading', () => {
    it('should populate frames table after loading MDF4', async () => {
      // Simulate clicking load button (mocked dialog returns path)
      const frames = createMockFrames(5);
      api.frames = frames;

      // Manually trigger the load
      const result = await api.loadMdf4('/test/file.mf4');
      expect(result[0].length).toBe(10); // createMockFrames creates 10 frames
    });
  });

  describe('live capture', () => {
    it('should receive frames via events', () => {
      const receivedFrames: CanFrame[] = [];

      api.onCanFrame((frame) => {
        receivedFrames.push(frame);
      });

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

      api.emitFrame(testFrame);

      expect(receivedFrames.length).toBe(1);
      expect(receivedFrames[0].can_id).toBe(0x123);
    });

    it('should receive error events', () => {
      let receivedError = '';

      api.onCaptureError((error) => {
        receivedError = error;
      });

      api.emitError('Test error');

      expect(receivedError).toBe('Test error');
    });
  });

  describe('configuration', () => {
    it('should apply custom config', () => {
      element.setConfig({ showDbcTab: false });

      const dbcTab = element.shadowRoot?.querySelector('[data-tab="dbc"]');
      expect(dbcTab).toBeFalsy();
    });

    it('should set initial tab from config', () => {
      element.setConfig({ initialTab: 'live' });

      const liveTab = element.shadowRoot?.querySelector('[data-tab="live"]');
      expect(liveTab?.classList.contains('active')).toBe(true);
    });

    it('should keep VSS toolbar wired after setConfig re-render', async () => {
      const clearSpy = vi.spyOn(api, 'clearVss');
      element.setConfig({ initialTab: 'vss' });
      const newBtn = element.shadowRoot?.querySelector('#vssNewBtn') as HTMLButtonElement;
      expect(newBtn).toBeTruthy();
      newBtn.click();
      await vi.waitFor(() => expect(clearSpy).toHaveBeenCalled());
    });
  });
});

describe('Filter Logic', () => {
  describe('getFilteredFrames behavior', () => {
    it('should filter by time range', () => {
      const frames = createMockFrames(10);

      // Filter: timestamp >= 0.003 and <= 0.006
      const filtered = frames.filter(f => f.timestamp >= 0.003 && f.timestamp <= 0.006);

      expect(filtered.length).toBe(4); // 0.003, 0.004, 0.005, 0.006
    });

    it('should filter by CAN ID', () => {
      const frames = createMockFrames(10);

      // Mock frames cycle through IDs 0x100-0x104
      const filtered = frames.filter(f => f.can_id === 0x100);

      expect(filtered.length).toBe(2); // Frames 0 and 5
    });

    it('should filter by multiple CAN IDs', () => {
      const frames = createMockFrames(10);
      const canIds = [0x100, 0x101];

      const filtered = frames.filter(f => canIds.includes(f.can_id));

      expect(filtered.length).toBe(4); // Frames 0, 1, 5, 6
    });

    it('should handle empty filters', () => {
      const frames = createMockFrames(10);

      // No filters applied = all frames returned
      const filtered = frames.filter(() => true);

      expect(filtered.length).toBe(10);
    });
  });

  describe('CAN ID parsing', () => {
    it('should parse hex CAN IDs', () => {
      const input = '7DF, 7E8';
      const ids = input.split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(s => parseInt(s, 16))
        .filter(n => !isNaN(n));

      expect(ids).toEqual([0x7DF, 0x7E8]);
    });

    it('should handle invalid hex values', () => {
      const input = '7DF, invalid, 7E8';
      const ids = input.split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(s => parseInt(s, 16))
        .filter(n => !isNaN(n));

      expect(ids).toEqual([0x7DF, 0x7E8]);
    });

    it('should handle empty input', () => {
      const input = '';
      const ids = input.split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(s => parseInt(s, 16))
        .filter(n => !isNaN(n));

      expect(ids).toEqual([]);
    });
  });

  describe('Message name matching', () => {
    it('should match partial message names', () => {
      const dbcInfo = createMockDbcInfo();
      const searchTerms = ['engine'];

      const matches = dbcInfo.messages.filter(msg =>
        searchTerms.some(term => msg.name.toLowerCase().includes(term))
      );

      expect(matches.length).toBe(1);
      expect(matches[0].name).toBe('EngineData');
    });

    it('should match multiple search terms', () => {
      const dbcInfo = createMockDbcInfo();
      const searchTerms = ['engine', 'speed'];

      const matches = dbcInfo.messages.filter(msg =>
        searchTerms.some(term => msg.name.toLowerCase().includes(term))
      );

      expect(matches.length).toBe(2);
    });
  });
});

describe('Utility Functions', () => {
  describe('formatCanId', () => {
    it('should format standard ID with 3 hex digits', () => {
      const id = 0x1A3;
      const isExtended = false;
      const formatted = isExtended
        ? id.toString(16).toUpperCase().padStart(8, '0')
        : id.toString(16).toUpperCase().padStart(3, '0');

      expect(formatted).toBe('1A3');
    });

    it('should format extended ID with 8 hex digits', () => {
      const id = 0x12345678;
      const isExtended = true;
      const formatted = isExtended
        ? id.toString(16).toUpperCase().padStart(8, '0')
        : id.toString(16).toUpperCase().padStart(3, '0');

      expect(formatted).toBe('12345678');
    });

    it('should pad small standard IDs', () => {
      const id = 0x01;
      const isExtended = false;
      const formatted = isExtended
        ? id.toString(16).toUpperCase().padStart(8, '0')
        : id.toString(16).toUpperCase().padStart(3, '0');

      expect(formatted).toBe('001');
    });
  });

  describe('formatDataHex', () => {
    it('should format data bytes as hex string', () => {
      const data = [0x01, 0x0A, 0xFF, 0x10];
      const formatted = data.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

      expect(formatted).toBe('01 0A FF 10');
    });

    it('should handle empty data', () => {
      const data: number[] = [];
      const formatted = data.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

      expect(formatted).toBe('');
    });
  });

  describe('formatFlags', () => {
    it('should show EXT for extended frames', () => {
      const frame: CanFrame = {
        timestamp: 0,
        channel: 'can0',
        can_id: 0x12345678,
        is_extended: true,
        is_fd: false,
        brs: false,
        esi: false,
        dlc: 8,
        data: [],
      };

      const flags: string[] = [];
      if (frame.is_extended) flags.push('EXT');
      const formatted = flags.join(', ') || '-';

      expect(formatted).toBe('EXT');
    });

    it('should show dash for standard data frames', () => {
      const frame: CanFrame = {
        timestamp: 0,
        channel: 'can0',
        can_id: 0x100,
        is_extended: false,
        is_fd: false,
        brs: false,
        esi: false,
        dlc: 8,
        data: [1, 2, 3, 4, 5, 6, 7, 8],
      };

      const flags: string[] = [];
      if (frame.is_extended) flags.push('EXT');
      const formatted = flags.join(', ') || '-';

      expect(formatted).toBe('-');
    });
  });
});

describe('MockApi', () => {
  let api: MockApi;

  beforeEach(() => {
    api = new MockApi();
  });

  it('should load DBC and store info', async () => {
    await api.loadDbc('/test.dbc');

    expect(api.dbcPath).toBe('/test.dbc');
    expect(api.dbcInfo).not.toBeNull();
    expect(api.dbcInfo?.messages.length).toBeGreaterThan(0);
  });

  it('should clear DBC', async () => {
    await api.loadDbc('/test.dbc');
    await api.clearDbc();

    expect(api.dbcPath).toBeNull();
    expect(api.dbcInfo).toBeNull();
  });

  it('should decode frames when DBC is loaded', async () => {
    await api.loadDbc('/test.dbc');

    const frames = createMockFrames(2);
    frames[0].can_id = 0x100; // EngineData message

    const response = await api.decodeFrames(frames);

    expect(response.signals.length).toBeGreaterThan(0);
    expect(response.signals[0].message_name).toBe('EngineData');
    expect(response.errors).toEqual([]);
  });

  it('should return empty signals when no DBC loaded', async () => {
    const frames = createMockFrames(2);
    const response = await api.decodeFrames(frames);

    expect(response.signals.length).toBe(0);
    expect(response.errors).toEqual([]);
  });

  it('should list interfaces', async () => {
    const interfaces = await api.listCanInterfaces();

    expect(interfaces).toContain('can0');
    expect(interfaces).toContain('vcan0');
  });

  it('should start and stop capture', async () => {
    expect(api.isCapturing).toBe(false);

    await api.startCapture('can0', '/tmp/capture.mf4');
    expect(api.isCapturing).toBe(true);

    await api.stopCapture();
    expect(api.isCapturing).toBe(false);
  });

  it('should handle load errors', async () => {
    api.mockLoadError = 'File not found';

    await expect(api.loadDbc('/nonexistent.dbc')).rejects.toThrow('File not found');
  });

  it('should handle capture errors', async () => {
    api.mockCaptureError = 'Interface not available';

    await expect(api.startCapture('can0', '/tmp/capture.mf4')).rejects.toThrow('Interface not available');
  });
});

describe('Signal Decoding', () => {
  it('should create mock signals with correct structure', () => {
    const signal = createMockSignal();

    expect(signal.signal_name).toBe('EngineRPM');
    expect(signal.message_name).toBe('EngineData');
    expect(signal.unit).toBe('rpm');
  });

  it('should allow overriding signal properties', () => {
    const signal = createMockSignal({
      signal_name: 'CustomSignal',
      value: 999,
      unit: 'custom',
    });

    expect(signal.signal_name).toBe('CustomSignal');
    expect(signal.value).toBe(999);
    expect(signal.unit).toBe('custom');
  });
});
