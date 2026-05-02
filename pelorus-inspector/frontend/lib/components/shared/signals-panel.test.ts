import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SignalsPanelElement } from './signals-panel';
import { createMockSignal } from '../../api';

// Mock CSS import
vi.mock('../../styles/pelorus-inspector.css?inline', () => ({
  default: '/* mocked styles */',
}));

describe('SignalsPanelElement', () => {
  let element: SignalsPanelElement;

  beforeEach(() => {
    // Register the custom element if not already registered
    if (!customElements.get('cv-signals-panel')) {
      customElements.define('cv-signals-panel', SignalsPanelElement);
    }

    element = document.createElement('cv-signals-panel') as SignalsPanelElement;
    element.innerHTML = `
      <div class="cv-table-header">
        <span class="cv-table-info" id="signalsCount">0 signals</span>
        <span class="cv-decode-error hidden"></span>
      </div>
      <div class="cv-table-wrapper">
        <table class="cv-table">
          <thead><tr><th>Signal</th><th>Value</th><th>Unit</th><th>Vessel (VSS)</th></tr></thead>
          <tbody id="signalsTableBody"></tbody>
        </table>
      </div>
    `;
    document.body.appendChild(element);
  });

  afterEach(() => {
    element.remove();
  });

  describe('setSignals', () => {
    it('should render signals in table body', () => {
      const signals = [
        createMockSignal({ signal_name: 'RPM' }),
        createMockSignal({ signal_name: 'Speed' }),
      ];
      element.setSignals(signals);

      const tbody = element.querySelector('#signalsTableBody');
      expect(tbody?.innerHTML).toContain('RPM');
      expect(tbody?.innerHTML).toContain('Speed');
    });

    it('should update signal count', () => {
      const signals = [
        createMockSignal(),
        createMockSignal(),
        createMockSignal(),
      ];
      element.setSignals(signals);

      const count = element.querySelector('#signalsCount');
      expect(count?.textContent).toBe('3 signals');
    });

    it('should handle empty signals array', () => {
      element.setSignals([]);

      const tbody = element.querySelector('#signalsTableBody');
      expect(tbody?.innerHTML).toContain('No signals decoded');

      const count = element.querySelector('#signalsCount');
      expect(count?.textContent).toBe('0 signals');
    });

    it('should display decode errors', () => {
      element.setSignals([], ['Frame 0x100: Payload length mismatch']);

      const errorEl = element.querySelector('.cv-decode-error');
      expect(errorEl?.textContent).toContain('Payload length mismatch');
      expect(errorEl?.classList.contains('hidden')).toBe(false);
    });

    it('should hide error container when no errors', () => {
      element.setSignals([createMockSignal()], []);

      const errorEl = element.querySelector('.cv-decode-error');
      expect(errorEl?.classList.contains('hidden')).toBe(true);
    });

    it('should display signal values and units', () => {
      const signals = [
        createMockSignal({ signal_name: 'Temp', value: 85.5, unit: 'C' }),
      ];
      element.setSignals(signals);

      const tbody = element.querySelector('#signalsTableBody');
      expect(tbody?.innerHTML).toContain('85.5000');
      expect(tbody?.innerHTML).toContain('C');
    });

    it('should render vessel_path when present', () => {
      const signals = [
        createMockSignal({
          signal_name: 'RPM',
          vessel_path: 'Vessel.Platform.Engine.RPM',
        }),
      ];
      element.setSignals(signals);

      const tbody = element.querySelector('#signalsTableBody');
      expect(tbody?.innerHTML).toContain('Vessel.Platform.Engine.RPM');
    });
  });

  describe('showEmpty', () => {
    it('should show placeholder message', () => {
      element.showEmpty();

      const tbody = element.querySelector('#signalsTableBody');
      expect(tbody?.innerHTML).toContain('Select a frame to view decoded signals');
    });

    it('should update count to "Select a frame"', () => {
      element.showEmpty();

      const count = element.querySelector('#signalsCount');
      expect(count?.textContent).toBe('Select a frame');
    });
  });
});
