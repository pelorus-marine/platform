import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CaptureControlsElement } from './capture-controls';

// Mock CSS import
vi.mock('../../styles/pelorus-inspector.css?inline', () => ({
  default: '/* mocked styles */',
}));

describe('CaptureControlsElement', () => {
  let element: CaptureControlsElement;

  beforeEach(() => {
    // Register the custom element if not already registered
    if (!customElements.get('cv-capture-controls')) {
      customElements.define('cv-capture-controls', CaptureControlsElement);
    }

    // Create a container with the element and its children
    const container = document.createElement('div');
    container.innerHTML = `
      <cv-capture-controls>
        <div class="cv-control-group">
          <label>Interface:</label>
          <select class="cv-select" id="interfaceSelect">
            <option value="">Select CAN interface...</option>
          </select>
          <button class="cv-btn" id="refreshInterfacesBtn">↻</button>
        </div>
        <div class="cv-control-group">
          <button class="cv-btn cv-btn-success" id="startCaptureBtn" disabled>Start Capture</button>
          <button class="cv-btn cv-btn-danger" id="stopCaptureBtn" disabled>Stop Capture</button>
        </div>
        <div class="cv-status">
          <span class="cv-status-dot" id="statusDot"></span>
          <span id="statusText">Idle</span>
        </div>
      </cv-capture-controls>
    `;
    document.body.appendChild(container);
    element = container.querySelector('cv-capture-controls') as CaptureControlsElement;
  });

  afterEach(() => {
    element.parentElement?.remove();
  });


  describe('setInterfaces', () => {
    it('should populate interface select options', () => {
      element.setInterfaces(['can0', 'vcan0', 'can1']);

      const select = element.querySelector('#interfaceSelect') as HTMLSelectElement;
      expect(select.options.length).toBe(4); // placeholder + 3 interfaces
      expect(select.options[1].value).toBe('can0');
      expect(select.options[2].value).toBe('vcan0');
      expect(select.options[3].value).toBe('can1');
    });

    it('should keep placeholder option', () => {
      element.setInterfaces(['can0']);

      const select = element.querySelector('#interfaceSelect') as HTMLSelectElement;
      expect(select.options[0].value).toBe('');
      expect(select.options[0].textContent).toContain('Select CAN interface');
    });

    it('should handle empty interfaces', () => {
      element.setInterfaces([]);

      const select = element.querySelector('#interfaceSelect') as HTMLSelectElement;
      expect(select.options.length).toBe(1); // only placeholder
    });
  });

  describe('getSelectedInterface', () => {
    it('should return selected interface', () => {
      element.setInterfaces(['can0', 'vcan0']);

      const select = element.querySelector('#interfaceSelect') as HTMLSelectElement;
      select.value = 'can0';

      expect(element.getSelectedInterface()).toBe('can0');
    });

    it('should return empty string when none selected', () => {
      element.setInterfaces(['can0', 'vcan0']);
      expect(element.getSelectedInterface()).toBe('');
    });
  });

  describe('setCaptureStatus', () => {
    it('should update UI when capturing', () => {
      element.setCaptureStatus(true);

      const dot = element.querySelector('#statusDot');
      const text = element.querySelector('#statusText');
      const stopBtn = element.querySelector('#stopCaptureBtn') as HTMLButtonElement;

      expect(dot?.classList.contains('active')).toBe(true);
      expect(text?.textContent).toBe('Capturing...');
      expect(stopBtn.disabled).toBe(false);
    });

    it('should update UI when idle', () => {
      // First set to capturing
      element.setCaptureStatus(true);
      // Then set to idle
      element.setCaptureStatus(false);

      const dot = element.querySelector('#statusDot');
      const text = element.querySelector('#statusText');
      const stopBtn = element.querySelector('#stopCaptureBtn') as HTMLButtonElement;

      expect(dot?.classList.contains('active')).toBe(false);
      expect(text?.textContent).toBe('Idle');
      expect(stopBtn.disabled).toBe(true);
    });

    it('should disable start button when capturing', () => {
      element.setInterfaces(['can0']);
      const select = element.querySelector('#interfaceSelect') as HTMLSelectElement;
      select.value = 'can0';
      select.dispatchEvent(new Event('change'));

      element.setCaptureStatus(true);

      const startBtn = element.querySelector('#startCaptureBtn') as HTMLButtonElement;
      expect(startBtn.disabled).toBe(true);
    });
  });

  describe('refresh-interfaces event', () => {
    it('should emit event when refresh button clicked', async () => {
      const eventPromise = new Promise<void>((resolve) => {
        element.addEventListener('refresh-interfaces', () => resolve(), { once: true });
      });

      const btn = element.querySelector('#refreshInterfacesBtn') as HTMLButtonElement;
      btn.click();

      await eventPromise;
    });
  });

  describe('start-capture event', () => {
    it('should emit event with interface when start clicked', async () => {
      element.setInterfaces(['can0', 'vcan0']);
      const select = element.querySelector('#interfaceSelect') as HTMLSelectElement;
      select.value = 'can0';
      select.dispatchEvent(new Event('change'));

      const eventPromise = new Promise<CustomEvent>((resolve) => {
        element.addEventListener('start-capture', (e) => resolve(e as CustomEvent), { once: true });
      });

      const btn = element.querySelector('#startCaptureBtn') as HTMLButtonElement;
      btn.click();

      const event = await eventPromise;
      expect(event.detail.interface).toBe('can0');
    });

    it('should not emit event when no interface selected', () => {
      let eventEmitted = false;
      element.addEventListener('start-capture', () => {
        eventEmitted = true;
      });

      const btn = element.querySelector('#startCaptureBtn') as HTMLButtonElement;
      btn.click();

      expect(eventEmitted).toBe(false);
    });
  });

  describe('stop-capture event', () => {
    it('should emit event when stop clicked', () => {
      // Enable the stop button first (it's disabled by default)
      element.setCaptureStatus(true);

      let eventEmitted = false;
      element.addEventListener('stop-capture', () => {
        eventEmitted = true;
      });

      const btn = element.querySelector('#stopCaptureBtn') as HTMLButtonElement;
      expect(btn.disabled).toBe(false); // Verify button is enabled
      btn.click();

      expect(eventEmitted).toBe(true);
    });
  });

  describe('button state management', () => {
    it('should enable start button when interface is selected', () => {
      element.setInterfaces(['can0']);
      const select = element.querySelector('#interfaceSelect') as HTMLSelectElement;
      const startBtn = element.querySelector('#startCaptureBtn') as HTMLButtonElement;

      expect(startBtn.disabled).toBe(true);

      select.value = 'can0';
      select.dispatchEvent(new Event('change'));

      expect(startBtn.disabled).toBe(false);
    });

    it('should disable start button when placeholder selected', () => {
      element.setInterfaces(['can0']);
      const select = element.querySelector('#interfaceSelect') as HTMLSelectElement;
      const startBtn = element.querySelector('#startCaptureBtn') as HTMLButtonElement;

      select.value = 'can0';
      select.dispatchEvent(new Event('change'));
      expect(startBtn.disabled).toBe(false);

      select.value = '';
      select.dispatchEvent(new Event('change'));
      expect(startBtn.disabled).toBe(true);
    });
  });
});
