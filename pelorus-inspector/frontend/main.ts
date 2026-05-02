import { TauriApi, PelorusInspectorElement } from './lib';

// Initialize and set up the Pelorus Inspector
async function main(): Promise<void> {
  // Create the API
  const api = new TauriApi();
  await api.init();

  // Get the viewer element and set the API
  const viewer = document.querySelector('pelorus-inspector') as PelorusInspectorElement;
  if (viewer) {
    viewer.setApi(api);
  }
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
