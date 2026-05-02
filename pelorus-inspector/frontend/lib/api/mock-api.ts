import type {
  InspectorApi,
  CanFrame,
  DecodeResponse,
  DecodedSignal,
  DbcInfo,
  InitialFiles,
  FileFilter,
  LiveCaptureUpdate,
  StatsHtml,
} from '../types';

/** Mock API implementation for testing */
export class MockApi implements InspectorApi {
  // Mock data stores
  public dbcPath: string | null = null;
  public dbcInfo: DbcInfo | null = null;
  public frames: CanFrame[] = [];
  public isCapturing = false;

  // Callbacks for events
  private frameCallbacks: ((frame: CanFrame) => void)[] = [];
  private signalCallbacks: ((signal: DecodedSignal) => void)[] = [];
  private decodeErrorCallbacks: ((error: string) => void)[] = [];
  private errorCallbacks: ((error: string) => void)[] = [];
  private updateCallbacks: ((update: LiveCaptureUpdate) => void)[] = [];
  private finalizedCallbacks: ((path: string) => void)[] = [];

  // Mock responses (can be configured for different test scenarios)
  public mockInterfaces: string[] = ['can0', 'vcan0'];
  public mockLoadError: string | null = null;
  public mockCaptureError: string | null = null;

  async loadDbc(path: string): Promise<string> {
    if (this.mockLoadError) {
      throw new Error(this.mockLoadError);
    }
    this.dbcPath = path;
    this.dbcInfo = createMockDbcInfo();
    return `Loaded DBC: ${path}`;
  }

  async clearDbc(): Promise<void> {
    this.dbcPath = null;
    this.dbcInfo = null;
  }

  async getDbcInfo(): Promise<DbcInfo | null> {
    return this.dbcInfo;
  }

  async getDbcPath(): Promise<string | null> {
    return this.dbcPath;
  }

  async getDbcSpecification(): Promise<string> {
    return '# DBC File Format Specification\n\n(Mock specification content)';
  }

  async decodeFrames(frames: CanFrame[]): Promise<DecodeResponse> {
    if (!this.dbcInfo) return { signals: [], errors: [] };

    const signals: DecodedSignal[] = [];
    const errors: string[] = [];
    for (const frame of frames) {
      const msg = this.dbcInfo.messages.find(m => m.id === frame.can_id);
      if (msg) {
        // Simulate DLC mismatch error
        if (frame.data.length < msg.dlc) {
          errors.push(`Frame 0x${frame.can_id.toString(16).toUpperCase()}: Payload length does not match message DLC (DLC=${msg.dlc}, data=${frame.data.length} bytes)`);
          continue;
        }
        for (const sig of msg.signals) {
          signals.push({
            timestamp: frame.timestamp,
            message_name: msg.name,
            signal_name: sig.name,
            value: 123.456,
            raw_value: 100,
            unit: sig.unit,
          });
        }
      }
    }
    return { signals, errors };
  }

  async loadMdf4(_path: string): Promise<[CanFrame[], DecodedSignal[]]> {
    if (this.mockLoadError) {
      throw new Error(this.mockLoadError);
    }
    this.frames = createMockFrames(10);
    return [this.frames, []];
  }

  async exportLogs(_path: string, frames: CanFrame[]): Promise<number> {
    return frames.length;
  }

  async listCanInterfaces(): Promise<string[]> {
    return this.mockInterfaces;
  }

  async startCapture(_iface: string, _captureFile: string, _append: boolean = false): Promise<void> {
    if (this.mockCaptureError) {
      throw new Error(this.mockCaptureError);
    }
    this.isCapturing = true;
  }

  async stopCapture(): Promise<string> {
    this.isCapturing = false;
    return '/tmp/mock-capture.mf4';
  }

  async getInitialFiles(): Promise<InitialFiles> {
    return { dbc_path: null, mdf4_path: null };
  }

  async saveDbcContent(_path: string, _content: string): Promise<void> {
    // Mock implementation - just succeeds
  }

  async updateDbcContent(_content: string): Promise<string> {
    // Mock implementation - returns success message
    return 'Updated DBC';
  }

  async openFileDialog(_filters: FileFilter[]): Promise<string | null> {
    return '/test/path/file.dbc';
  }

  async saveFileDialog(_filters: FileFilter[], _defaultName?: string): Promise<string | null> {
    return '/test/path/export.mf4';
  }

  onCanFrame(callback: (frame: CanFrame) => void): () => void {
    this.frameCallbacks.push(callback);
    return () => {
      const idx = this.frameCallbacks.indexOf(callback);
      if (idx >= 0) this.frameCallbacks.splice(idx, 1);
    };
  }

  onDecodedSignal(callback: (signal: DecodedSignal) => void): () => void {
    this.signalCallbacks.push(callback);
    return () => {
      const idx = this.signalCallbacks.indexOf(callback);
      if (idx >= 0) this.signalCallbacks.splice(idx, 1);
    };
  }

  onDecodeError(callback: (error: string) => void): () => void {
    this.decodeErrorCallbacks.push(callback);
    return () => {
      const idx = this.decodeErrorCallbacks.indexOf(callback);
      if (idx >= 0) this.decodeErrorCallbacks.splice(idx, 1);
    };
  }

  onCaptureError(callback: (error: string) => void): () => void {
    this.errorCallbacks.push(callback);
    return () => {
      const idx = this.errorCallbacks.indexOf(callback);
      if (idx >= 0) this.errorCallbacks.splice(idx, 1);
    };
  }

  onLiveCaptureUpdate(callback: (update: LiveCaptureUpdate) => void): () => void {
    this.updateCallbacks.push(callback);
    return () => {
      const idx = this.updateCallbacks.indexOf(callback);
      if (idx >= 0) this.updateCallbacks.splice(idx, 1);
    };
  }

  onCaptureFinalized(callback: (path: string) => void): () => void {
    this.finalizedCallbacks.push(callback);
    return () => {
      const idx = this.finalizedCallbacks.indexOf(callback);
      if (idx >= 0) this.finalizedCallbacks.splice(idx, 1);
    };
  }

  // Test helpers to emit events
  emitFrame(frame: CanFrame): void {
    this.frameCallbacks.forEach(cb => cb(frame));
  }

  emitSignal(signal: DecodedSignal): void {
    this.signalCallbacks.forEach(cb => cb(signal));
  }

  emitDecodeError(error: string): void {
    this.decodeErrorCallbacks.forEach(cb => cb(error));
  }

  emitError(error: string): void {
    this.errorCallbacks.forEach(cb => cb(error));
  }

  emitLiveCaptureUpdate(update: LiveCaptureUpdate): void {
    this.updateCallbacks.forEach(cb => cb(update));
  }

  emitCaptureFinalized(path: string): void {
    this.finalizedCallbacks.forEach(cb => cb(path));
  }
}

/** Create mock CAN frames for testing */
export function createMockFrames(count: number): CanFrame[] {
  const frames: CanFrame[] = [];
  for (let i = 0; i < count; i++) {
    frames.push({
      timestamp: i * 0.001,
      channel: 'can0',
      can_id: 0x100 + (i % 5),
      is_extended: false,
      is_fd: false,
      brs: false,
      esi: false,
      dlc: 8,
      data: [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08],
    });
  }
  return frames;
}

/** Create mock CAN FD frames for testing */
export function createMockFdFrames(count: number): CanFrame[] {
  const frames: CanFrame[] = [];
  for (let i = 0; i < count; i++) {
    frames.push({
      timestamp: i * 0.001,
      channel: 'can0',
      can_id: 0x200 + (i % 5),
      is_extended: false,
      is_fd: true,
      brs: true,
      esi: false,
      dlc: 15, // 64 bytes
      data: Array.from({ length: 64 }, (_, j) => (i + j) & 0xFF),
    });
  }
  return frames;
}

/** Create mock DBC info for testing */
export function createMockDbcInfo(): DbcInfo {
  return {
    nodes: [{ name: 'ECU' }, { name: 'ABS' }],
    messages: [
      {
        id: 0x100,
        name: 'EngineData',
        dlc: 8,
        sender: 'ECU',
        signals: [
          {
            name: 'EngineRPM',
            start_bit: 0,
            length: 16,
            byte_order: 'little_endian',
            is_signed: false,
            factor: 0.25,
            offset: 0,
            min: 0,
            max: 16000,
            unit: 'rpm',
          },
          {
            name: 'EngineTemp',
            start_bit: 16,
            length: 8,
            byte_order: 'little_endian',
            is_signed: true,
            factor: 1,
            offset: -40,
            min: -40,
            max: 215,
            unit: 'C',
          },
        ],
      },
      {
        id: 0x101,
        name: 'VehicleSpeed',
        dlc: 8,
        sender: 'ECU',
        signals: [
          {
            name: 'Speed',
            start_bit: 0,
            length: 16,
            byte_order: 'little_endian',
            is_signed: false,
            factor: 0.01,
            offset: 0,
            min: 0,
            max: 655,
            unit: 'km/h',
          },
        ],
      },
      {
        id: 0x102,
        name: 'BrakeStatus',
        dlc: 8,
        sender: 'ABS',
        signals: [],
      },
    ],
    value_descriptions: [],
    attribute_definitions: [],
    attribute_defaults: [],
    attribute_values: [],
    extended_multiplexing: [],
  };
}

/** Create a mock decoded signal for testing */
export function createMockSignal(overrides: Partial<DecodedSignal> = {}): DecodedSignal {
  return {
    timestamp: 0,
    message_name: 'EngineData',
    signal_name: 'EngineRPM',
    value: 3500,
    raw_value: 14000,
    unit: 'rpm',
    ...overrides,
  };
}

/** Create a mock live capture update with pre-rendered HTML */
export function createMockLiveCaptureUpdate(): LiveCaptureUpdate {
  const stats = {
    frame_count: 100,
    message_count: 3,
    signal_count: 5,
    frame_rate: 50.0,
    elapsed_secs: 10.5,
    capture_file: '/tmp/mock.mf4',
  };

  const stats_html: StatsHtml = {
    message_count: '3',
    frame_count: '100',
    frame_rate: '50/s',
    elapsed: '0:10',
  };

  const messages_html = `
    <tr><td class="cv-cell-id">0x100</td><td class="cv-cell-name">EngineData</td><td class="cv-cell-data">01 02 03 04 05 06 07 08</td><td>50</td><td>25.0/s</td></tr>
    <tr><td class="cv-cell-id">0x101</td><td class="cv-cell-name">VehicleSpeed</td><td class="cv-cell-data">00 64 00 00 00 00 00 00</td><td>30</td><td>15.0/s</td></tr>
    <tr><td class="cv-cell-id">0x102</td><td class="cv-cell-name">BrakeStatus</td><td class="cv-cell-data">01 00 00 00 00 00 00 00</td><td>20</td><td>10.0/s</td></tr>
  `.trim();

  const signals_html = `
    <tr><td class="cv-cell-name">EngineRPM</td><td class="cv-cell-value">3500</td><td class="cv-cell-unit">rpm</td><td class="cv-cell-dim">EngineData</td></tr>
    <tr><td class="cv-cell-name">EngineTemp</td><td class="cv-cell-value">85</td><td class="cv-cell-unit">C</td><td class="cv-cell-dim">EngineData</td></tr>
    <tr><td class="cv-cell-name">Speed</td><td class="cv-cell-value">100.5</td><td class="cv-cell-unit">km/h</td><td class="cv-cell-dim">VehicleSpeed</td></tr>
  `.trim();

  const frames_html = `
    <tr><td class="cv-cell-dim">0.001000</td><td class="cv-cell-id">0x100</td><td>8</td><td class="cv-cell-data">01 02 03 04 05 06 07 08</td><td>-</td></tr>
    <tr><td class="cv-cell-dim">0.002000</td><td class="cv-cell-id">0x101</td><td>8</td><td class="cv-cell-data">00 64 00 00 00 00 00 00</td><td>-</td></tr>
  `.trim();

  return {
    stats,
    messages_html,
    signals_html,
    frames_html,
    errors_html: '',
    stats_html,
    message_count: 3,
    signal_count: 3,
    frame_count: 2,
    error_count: 0,
  };
}
