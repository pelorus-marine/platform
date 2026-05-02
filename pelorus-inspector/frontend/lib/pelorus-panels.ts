/**
 * Registers the built-in Pelorus Inspector panels (CAN lab, simulator, decoder, workflow, storage).
 */

import type { InspectorExtension } from './types';

import './can-config/index.js';
import './simulator/index.js';
import './decoder/index.js';
import './workflow/index.js';
import './storage/storage-panel.js';
import './storage/storage-toolbar.js';

const BUILTIN_PANELS: InspectorExtension[] = [
  {
    id: 'can-config',
    tab: { id: 'can', label: 'CAN', title: 'SocketCAN interfaces, gateways, and filters' },
    toolbar: 'cv-can-config-toolbar',
    panel: 'cv-can-config',
  },
  {
    id: 'traffic-simulator',
    tab: { id: 'simulator', label: 'Simulator', title: 'Rhai traffic generator' },
    toolbar: 'cv-simulator-toolbar',
    panel: 'cv-traffic-simulator',
  },
  {
    id: 'message-decoder',
    tab: { id: 'decoder', label: 'Decoder', title: 'Frame patterns and signal hints' },
    toolbar: 'cv-decoder-toolbar',
    panel: 'cv-message-decoder',
  },
  {
    id: 'workflow',
    tab: { id: 'workflow', label: 'Workflow', title: 'CAN / MDF4 processing DAG' },
    toolbar: 'cv-workflow-toolbar',
    panel: 'cv-workflow-editor',
  },
  {
    id: 'storage',
    tab: {
      id: 'storage',
      label: 'Storage',
      title: 'SQLite stash: DBC, MDF4, Rhai, workflows',
    },
    toolbar: 'cv-storage-toolbar',
    panel: 'cv-storage-panel',
  },
];

export async function registerPelorusPanels(viewer: {
  registerExtension: (ext: InspectorExtension, disabled?: boolean) => Promise<void>;
}): Promise<void> {
  for (const ext of BUILTIN_PANELS) {
    await viewer.registerExtension(ext);
  }
}
