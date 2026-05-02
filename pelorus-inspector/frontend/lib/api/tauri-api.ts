import { open, save } from '@tauri-apps/plugin-dialog';
import type {
  InspectorApi,
  CanFrame,
  DecodeResponse,
  DecodedSignal,
  DbcInfo,
  InitialFiles,
  FileFilter,
  LiveCaptureUpdate,
  CanBpfFilter,
} from '../types';

/** Tauri API implementation for Pelorus Inspector */
export class TauriApi implements InspectorApi {
  private invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  private listen: (event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>;

  constructor() {
    // These will be initialized when Tauri is ready
    this.invoke = async () => { throw new Error('Tauri not initialized'); };
    this.listen = async () => () => {};
  }

  /** Initialize Tauri APIs - call this before using the API */
  async init(): Promise<void> {
    type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    type ListenFn = (event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>;

    const tauri = (window as unknown as { __TAURI__: {
      core: { invoke: InvokeFn };
      event: { listen: ListenFn };
    } }).__TAURI__;

    if (!tauri) {
      throw new Error('Tauri API not available');
    }

    this.invoke = tauri.core.invoke;
    this.listen = tauri.event.listen;
  }

  async loadDbc(path: string): Promise<string> {
    return await this.invoke('load_dbc', { path }) as string;
  }

  async clearDbc(): Promise<void> {
    await this.invoke('clear_dbc');
  }

  async getDbcInfo(): Promise<DbcInfo | null> {
    return await this.invoke('get_dbc_info') as DbcInfo | null;
  }

  async getDbcPath(): Promise<string | null> {
    return await this.invoke('get_dbc_path') as string | null;
  }

  async getDbcSpecification(): Promise<string> {
    return await this.invoke('get_dbc_specification') as string;
  }

  async decodeFrames(frames: CanFrame[]): Promise<DecodeResponse> {
    return await this.invoke('decode_frames', { frames }) as DecodeResponse;
  }

  async loadMdf4(path: string): Promise<[CanFrame[], DecodedSignal[]]> {
    return await this.invoke('load_mdf4', { path }) as [CanFrame[], DecodedSignal[]];
  }

  async exportLogs(path: string, frames: CanFrame[]): Promise<number> {
    return await this.invoke('export_logs', { path, frames }) as number;
  }

  async listCanInterfaces(): Promise<string[]> {
    return await this.invoke('list_can_interfaces') as string[];
  }

  async startCapture(iface: string, captureFile: string, append: boolean = false, filters?: CanBpfFilter[]): Promise<void> {
    await this.invoke('start_capture', { interface: iface, captureFile, append, filters: filters || null });
  }

  async stopCapture(): Promise<string> {
    return await this.invoke('stop_capture') as string;
  }

  async getInitialFiles(): Promise<InitialFiles> {
    return await this.invoke('get_initial_files') as InitialFiles;
  }

  async saveDbcContent(path: string, content: string): Promise<void> {
    await this.invoke('save_dbc_content', { path, content });
  }

  async updateDbcContent(content: string): Promise<string> {
    return await this.invoke('update_dbc_content', { content }) as string;
  }

  async openFileDialog(filters: FileFilter[]): Promise<string | null> {
    const result = await open({
      multiple: false,
      filters,
    });
    // open() returns string | string[] | null
    if (Array.isArray(result)) return result[0] || null;
    return result;
  }

  async saveFileDialog(filters: FileFilter[], defaultName?: string): Promise<string | null> {
    return await save({
      filters,
      defaultPath: defaultName,
    });
  }

  onCanFrame(callback: (frame: CanFrame) => void): () => void {
    const promise = this.listen('can-frame', (event) => {
      callback(event.payload as CanFrame);
    });
    return () => { promise.then(fn => fn()); };
  }

  onDecodedSignal(callback: (signal: DecodedSignal) => void): () => void {
    const promise = this.listen('decoded-signal', (event) => {
      callback(event.payload as DecodedSignal);
    });
    return () => { promise.then(fn => fn()); };
  }

  onDecodeError(callback: (error: string) => void): () => void {
    const promise = this.listen('decode-error', (event) => {
      callback(event.payload as string);
    });
    return () => { promise.then(fn => fn()); };
  }

  onCaptureError(callback: (error: string) => void): () => void {
    const promise = this.listen('capture-error', (event) => {
      callback(event.payload as string);
    });
    return () => { promise.then(fn => fn()); };
  }

  onLiveCaptureUpdate(callback: (update: LiveCaptureUpdate) => void): () => void {
    const promise = this.listen('live-capture-update', (event) => {
      callback(event.payload as LiveCaptureUpdate);
    });
    return () => { promise.then(fn => fn()); };
  }

  onCaptureFinalized(callback: (path: string) => void): () => void {
    const promise = this.listen('capture-finalized', (event) => {
      callback(event.payload as string);
    });
    return () => { promise.then(fn => fn()); };
  }
}
