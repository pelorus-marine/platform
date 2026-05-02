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
  VssSnapshotDto,
  VssCatalogDto,
} from '../types';

import { assertTauriReady, invoke, listen, dialogs } from '../ipc.js';

/** Tauri API implementation for Pelorus Inspector */
export class TauriApi implements InspectorApi {
  /** Ensure Tauri is available before calling other methods */
  async init(): Promise<void> {
    assertTauriReady();
  }

  async loadDbc(path: string): Promise<string> {
    return invoke('load_dbc', { path }) as Promise<string>;
  }

  async clearDbc(): Promise<void> {
    await invoke('clear_dbc');
  }

  async getDbcInfo(): Promise<DbcInfo | null> {
    return invoke('get_dbc_info') as Promise<DbcInfo | null>;
  }

  async getDbcPath(): Promise<string | null> {
    return invoke('get_dbc_path') as Promise<string | null>;
  }

  async getDbcSpecification(): Promise<string> {
    return invoke('get_dbc_specification') as Promise<string>;
  }

  async decodeFrames(frames: CanFrame[]): Promise<DecodeResponse> {
    return invoke('decode_frames', { frames }) as Promise<DecodeResponse>;
  }

  async loadMdf4(path: string): Promise<[CanFrame[], DecodedSignal[]]> {
    return invoke('load_mdf4', { path }) as Promise<[CanFrame[], DecodedSignal[]]>;
  }

  async exportLogs(path: string, frames: CanFrame[]): Promise<number> {
    return invoke('export_logs', { path, frames }) as Promise<number>;
  }

  async listCanInterfaces(): Promise<string[]> {
    return invoke('list_can_interfaces') as Promise<string[]>;
  }

  async startCapture(
    iface: string,
    captureFile: string,
    append = false,
    filters?: CanBpfFilter[],
  ): Promise<void> {
    await invoke('start_capture', {
      interface: iface,
      captureFile,
      append,
      filters: filters ?? null,
    });
  }

  async stopCapture(): Promise<string> {
    return invoke('stop_capture') as Promise<string>;
  }

  async getInitialFiles(): Promise<InitialFiles> {
    return invoke('get_initial_files') as Promise<InitialFiles>;
  }

  async saveDbcContent(path: string, content: string): Promise<void> {
    await invoke('save_dbc_content', { path, content });
  }

  async updateDbcContent(content: string): Promise<string> {
    return invoke('update_dbc_content', { content }) as Promise<string>;
  }

  async loadVss(path: string): Promise<VssSnapshotDto> {
    return invoke('load_vss', { path }) as Promise<VssSnapshotDto>;
  }

  async clearVss(emitChanged = true): Promise<void> {
    await invoke('clear_vss', { emitChanged });
  }

  async getVssPath(): Promise<string | null> {
    return invoke('get_vss_path') as Promise<string | null>;
  }

  async getVssSnapshot(): Promise<VssSnapshotDto | null> {
    return invoke('get_vss_snapshot') as Promise<VssSnapshotDto | null>;
  }

  async saveVssContent(path: string, content: string): Promise<void> {
    await invoke('save_vss_content', { path, content });
  }

  async updateVssContent(content: string): Promise<string> {
    return invoke('update_vss_content', { content }) as Promise<string>;
  }

  async updateVssCatalog(dto: VssCatalogDto): Promise<VssSnapshotDto> {
    return invoke('update_vss_catalog', { dto }) as Promise<VssSnapshotDto>;
  }

  async serializeVssCatalog(dto: VssCatalogDto): Promise<string> {
    return invoke('serialize_vss_catalog', { dto }) as Promise<string>;
  }

  async openFileDialog(filters: FileFilter[]): Promise<string | null> {
    return dialogs.open(filters);
  }

  async saveFileDialog(filters: FileFilter[], defaultName?: string): Promise<string | null> {
    return dialogs.save(filters, defaultName);
  }

  onCanFrame(callback: (frame: CanFrame) => void): () => void {
    const p = listen('can-frame', (event) => {
      callback(event.payload as CanFrame);
    });
    return () => void p.then((fn) => fn());
  }

  onDecodedSignal(callback: (signal: DecodedSignal) => void): () => void {
    const p = listen('decoded-signal', (event) => {
      callback(event.payload as DecodedSignal);
    });
    return () => void p.then((fn) => fn());
  }

  onDecodeError(callback: (error: string) => void): () => void {
    const p = listen('decode-error', (event) => {
      callback(event.payload as string);
    });
    return () => void p.then((fn) => fn());
  }

  onCaptureError(callback: (error: string) => void): () => void {
    const p = listen('capture-error', (event) => {
      callback(event.payload as string);
    });
    return () => void p.then((fn) => fn());
  }

  onLiveCaptureUpdate(callback: (update: LiveCaptureUpdate) => void): () => void {
    const p = listen('live-capture-update', (event) => {
      callback(event.payload as LiveCaptureUpdate);
    });
    return () => void p.then((fn) => fn());
  }

  onCaptureFinalized(callback: (path: string) => void): () => void {
    const p = listen('capture-finalized', (event) => {
      callback(event.payload as string);
    });
    return () => void p.then((fn) => fn());
  }
}
