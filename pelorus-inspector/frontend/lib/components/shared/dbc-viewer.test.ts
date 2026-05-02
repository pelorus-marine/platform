import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DbcViewerElement } from './dbc-viewer';
import { createMockDbcInfo } from '../../api';

// Mock CSS import
vi.mock('../../styles/pelorus-inspector.css?inline', () => ({
  default: '/* mocked styles */',
}));

describe('DbcViewerElement', () => {
  let element: DbcViewerElement;

  beforeEach(() => {
    // Register the custom element if not already registered
    if (!customElements.get('cv-dbc-viewer')) {
      customElements.define('cv-dbc-viewer', DbcViewerElement);
    }

    element = document.createElement('cv-dbc-viewer') as DbcViewerElement;
    element.innerHTML = `
      <div class="cv-card">
        <div class="cv-card-header">Messages</div>
        <div class="cv-card-body" id="dbcMessagesList">
          <div class="cv-empty">No DBC file loaded</div>
        </div>
      </div>
      <div class="cv-card">
        <div class="cv-card-header">
          <div class="cv-detail-title" id="dbcDetailsTitle">Select a message</div>
          <div class="cv-detail-subtitle" id="dbcDetailsSubtitle"></div>
        </div>
        <div class="cv-card-body padded" id="dbcDetailsContent">
          <div class="cv-empty">Select a message to view its signals</div>
        </div>
      </div>
    `;
    document.body.appendChild(element);
  });

  afterEach(() => {
    element.remove();
  });

  describe('setDbcInfo', () => {
    it('should render messages list when DBC is loaded', () => {
      const dbcInfo = createMockDbcInfo();
      element.setDbcInfo(dbcInfo);

      const list = element.querySelector('.cv-card-body');
      expect(list?.innerHTML).toContain('EngineData');
      expect(list?.innerHTML).toContain('VehicleSpeed');
      expect(list?.innerHTML).toContain('BrakeStatus');
    });

    it('should show "No DBC file loaded" when DBC is null', () => {
      element.setDbcInfo(null);

      const list = element.querySelector('.cv-card-body');
      expect(list?.innerHTML).toContain('No DBC file loaded');
    });

    it('should reset selection when DBC changes', () => {
      const dbcInfo = createMockDbcInfo();
      element.setDbcInfo(dbcInfo);

      // Select a message
      const item = element.querySelector('.cv-list-item') as HTMLElement;
      item?.click();

      // Load new DBC
      element.setDbcInfo(createMockDbcInfo());

      // Details should be reset
      const title = element.querySelector('.cv-detail-title');
      expect(title?.textContent).toBe('Select a message');
    });

    it('should render message items as clickable', () => {
      const dbcInfo = createMockDbcInfo();
      element.setDbcInfo(dbcInfo);

      const items = element.querySelectorAll('.cv-list-item');
      expect(items.length).toBe(3);
    });
  });

  describe('message selection', () => {
    it('should update details when message is clicked', () => {
      const dbcInfo = createMockDbcInfo();
      element.setDbcInfo(dbcInfo);

      const item = element.querySelector('[data-id="256"]') as HTMLElement; // 0x100
      item?.click();

      const title = element.querySelector('.cv-detail-title');
      const subtitle = element.querySelector('.cv-detail-subtitle');

      expect(title?.textContent).toBe('EngineData');
      expect(subtitle?.textContent).toContain('0x100');
    });

    it('should render signals for selected message', () => {
      const dbcInfo = createMockDbcInfo();
      element.setDbcInfo(dbcInfo);

      const item = element.querySelector('[data-id="256"]') as HTMLElement;
      item?.click();

      const content = element.querySelector('.cv-card-body.padded');
      expect(content?.innerHTML).toContain('EngineRPM');
      expect(content?.innerHTML).toContain('EngineTemp');
    });

    it('should mark selected message as selected', () => {
      const dbcInfo = createMockDbcInfo();
      element.setDbcInfo(dbcInfo);

      const item = element.querySelector('[data-id="256"]') as HTMLElement;
      item?.click();

      // After re-render, the item should have selected class
      const selectedItem = element.querySelector('.cv-list-item.selected');
      expect(selectedItem).toBeTruthy();
    });

    it('should emit message-selected event', async () => {
      const dbcInfo = createMockDbcInfo();
      element.setDbcInfo(dbcInfo);

      const eventPromise = new Promise<CustomEvent>((resolve) => {
        element.addEventListener('message-selected', (e) => resolve(e as CustomEvent), { once: true });
      });

      const item = element.querySelector('[data-id="256"]') as HTMLElement;
      item?.click();

      const event = await eventPromise;
      expect(event.detail.message.name).toBe('EngineData');
      expect(event.detail.message.id).toBe(0x100);
    });
  });

  describe('empty states', () => {
    it('should show placeholder when no message selected', () => {
      const dbcInfo = createMockDbcInfo();
      element.setDbcInfo(dbcInfo);

      const content = element.querySelector('.cv-card-body.padded');
      expect(content?.innerHTML).toContain('Select a message to view its signals');
    });

    it('should show "No signals defined" for message without signals', () => {
      const dbcInfo = createMockDbcInfo();
      element.setDbcInfo(dbcInfo);

      // BrakeStatus has no signals
      const item = element.querySelector('[data-id="258"]') as HTMLElement; // 0x102
      item?.click();

      const content = element.querySelector('.cv-card-body.padded');
      expect(content?.innerHTML).toContain('No signals defined for this message');
    });
  });
});
