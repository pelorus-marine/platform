/**
 * Storage Types
 *
 * Type definitions for the embedded artifact storage system.
 */

/** Artifact type - matches backend ArtifactType */
export type ArtifactType = 'dbc' | 'mdf4' | 'rhai' | 'workflow';

/** Artifact metadata (without content) - matches backend ArtifactMeta */
export interface ArtifactMeta {
  id: number;
  name: string;
  type: ArtifactType;
  size: number;
  createdAt: string;
  updatedAt: string;
}

/** Storage tab type (same as ArtifactType) */
export type StorageTab = ArtifactType;

/** File extensions for each artifact type */
export const ARTIFACT_EXTENSIONS: Record<ArtifactType, string[]> = {
  dbc: ['dbc'],
  mdf4: ['mf4', 'mdf'],
  rhai: ['rhai'],
  workflow: ['workflow.json', 'json'],
};

/** Display labels for each artifact type */
export const ARTIFACT_LABELS: Record<ArtifactType, string> = {
  dbc: 'DBC Files',
  mdf4: 'MDF4 Files',
  rhai: 'Rhai Scripts',
  workflow: 'Workflows',
};

/** Icon SVG paths for each artifact type */
export const ARTIFACT_ICONS: Record<ArtifactType, string> = {
  dbc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
  mdf4: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/>',
  rhai: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  workflow: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
};
