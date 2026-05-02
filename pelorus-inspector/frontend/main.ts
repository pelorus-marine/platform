import { PelorusInspectorElement, TauriApi } from './lib';
import { registerPelorusPanels } from './lib/pelorus-panels';

function reportBootstrapError(err: unknown): void {
  console.error('[Pelorus Inspector] bootstrap failed', err);
}

/** Wire Tauri API, viewer element, and built-in lab panels. */
async function bootstrap(): Promise<void> {
  const api = new TauriApi();
  await api.init();

  const viewer = document.querySelector('pelorus-inspector');
  if (!(viewer instanceof PelorusInspectorElement)) {
    reportBootstrapError(new Error('pelorus-inspector root element missing'));
    return;
  }

  viewer.setApi(api);
  await registerPelorusPanels(viewer);
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    () => void bootstrap().catch(reportBootstrapError),
  );
} else {
  void bootstrap().catch(reportBootstrapError);
}
