/**
 * Pelorus Inspector — shared Tauri IPC (invoke, events, file dialogs).
 */

import { open, save } from '@tauri-apps/plugin-dialog';
import type { FileFilter } from './types';

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
type ListenFn = (
  event: string,
  handler: (event: { payload: unknown }) => void,
) => Promise<() => void>;

interface TauriCore {
  core: { invoke: InvokeFn };
  event: { listen: ListenFn };
}

function tauri(): TauriCore | undefined {
  return (window as unknown as { __TAURI__?: TauriCore }).__TAURI__;
}

/** Throws if the app is not running under Tauri. */
export function assertTauriReady(): void {
  const t = tauri();
  if (!t?.core.invoke || !t?.event.listen) {
    throw new Error('Tauri API not available');
  }
}

export async function invoke<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const t = tauri();
  if (!t?.core.invoke) {
    throw new Error('Tauri API not available');
  }
  if (!args) {
    return (await t.core.invoke(cmd)) as T;
  }
  return (await t.core.invoke(cmd, args)) as T;
}

export async function listen(
  event: string,
  handler: (event: { payload: unknown }) => void,
): Promise<() => void> {
  const t = tauri();
  if (!t?.event.listen) {
    return () => {};
  }
  return t.event.listen(event, handler);
}

export const dialogs = {
  async open(filters: FileFilter[]): Promise<string | null> {
    const result = await open({ multiple: false, filters });
    if (Array.isArray(result)) return result[0] || null;
    return result;
  },

  async save(filters: FileFilter[], defaultPath?: string): Promise<string | null> {
    return await save({ filters, defaultPath });
  },
};
