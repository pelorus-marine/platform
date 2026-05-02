import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FramesTableElement } from './frames-table';
import { createMockFrames } from '../../api';

// Mock CSS import
vi.mock('../../styles/pelorus-inspector.css?inline', () => ({
  default: '/* mocked styles */',
}));

describe('FramesTableElement', () => {
  let element: FramesTableElement;

  beforeEach(() => {
    // Register the custom element if not already registered
    if (!customElements.get('cv-frames-table')) {
      customElements.define('cv-frames-table', FramesTableElement);
    }

    // Create element with necessary structure
    element = document.createElement('cv-frames-table') as FramesTableElement;
    element.innerHTML = `
      <div class="cv-table-header">
        <span class="cv-table-info" id="framesCount">0 frames</span>
      </div>
      <div class="cv-table-wrapper" id="framesTableWrapper">
        <table class="cv-table">
          <thead><tr><th>Timestamp</th></tr></thead>
          <tbody id="framesTableBody"></tbody>
        </table>
      </div>
    `;
    document.body.appendChild(element);
  });

  afterEach(() => {
    element.remove();
  });

  describe('setMessageNameLookup', () => {
    it('should set the message name lookup function', () => {
      const lookup = (canId: number) => canId === 0x100 ? 'EngineData' : '-';
      element.setMessageNameLookup(lookup);

      const frames = createMockFrames(1);
      frames[0].can_id = 0x100;
      element.setFrames(frames);

      const tbody = element.querySelector('#framesTableBody');
      expect(tbody?.innerHTML).toContain('EngineData');
    });
  });

  describe('setFrames', () => {
    it('should render frames in table body', () => {
      const frames = createMockFrames(3);
      element.setFrames(frames);

      const tbody = element.querySelector('#framesTableBody');
      const rows = tbody?.querySelectorAll('tr');
      expect(rows?.length).toBe(3);
    });

    it('should expose frame count via getter', () => {
      const frames = createMockFrames(5);
      element.setFrames(frames);

      expect(element.frameCount).toBe(5);
    });

    it('should handle empty frames array', () => {
      element.setFrames([]);

      const tbody = element.querySelector('#framesTableBody');
      expect(tbody?.innerHTML).toBe('');

      const count = element.querySelector('#framesCount');
      expect(count?.textContent).toBe('0 frames');
    });

    it('should make rows clickable', () => {
      const frames = createMockFrames(2);
      element.setFrames(frames);

      const rows = element.querySelectorAll('tr.clickable');
      expect(rows.length).toBe(2);
    });
  });

  describe('frame-selected event', () => {
    it('should emit frame-selected event when row is clicked', () => {
      const frames = createMockFrames(3);
      element.setFrames(frames);

      const eventPromise = new Promise<CustomEvent>((resolve) => {
        element.addEventListener('frame-selected', (e) => resolve(e as CustomEvent), { once: true });
      });

      const row = element.querySelector('tr.clickable') as HTMLElement;
      row?.click();

      return eventPromise.then((event) => {
        expect(event.detail.index).toBe(0);
        expect(event.detail.frame).toEqual(frames[0]);
      });
    });

    it('should include correct frame data in event', () => {
      const frames = createMockFrames(3);
      frames[1].can_id = 0x999;
      element.setFrames(frames);

      const eventPromise = new Promise<CustomEvent>((resolve) => {
        element.addEventListener('frame-selected', (e) => resolve(e as CustomEvent), { once: true });
      });

      const rows = element.querySelectorAll('tr.clickable');
      (rows[1] as HTMLElement)?.click();

      return eventPromise.then((event) => {
        expect(event.detail.index).toBe(1);
        expect(event.detail.frame.can_id).toBe(0x999);
      });
    });
  });
});
