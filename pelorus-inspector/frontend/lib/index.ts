// Pelorus Inspector Library Exports
export type {
  CanFrame,
  DecodedSignal,
  SignalInfo,
  MessageInfo,
  DbcInfo,
  InitialFiles,
  InspectorConfig,
  InspectorApi,
  FileFilter,
  // Extension system
  InspectorExtension,
  ExtensionTab,
} from './types';

export { TauriApi } from './api';
export { PelorusInspectorElement } from './pelorus-inspector';

// Test utilities
export {
  MockApi,
  createMockFrames,
  createMockDbcInfo,
  createMockSignal,
} from './api';
