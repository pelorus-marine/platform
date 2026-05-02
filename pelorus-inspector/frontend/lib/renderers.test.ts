import { describe, it, expect } from 'vitest';
import {
  renderDbcMessagesHtml,
  renderDbcSignalsHtml,
  getDbcMessageSubtitle,
  renderInterfaceOptions,
} from './renderers';
import { createMockDbcInfo } from './api';
import type { MessageInfo } from './types';

describe('renderers', () => {
  describe('renderDbcMessagesHtml', () => {
    it('should render DBC messages list', () => {
      const dbcInfo = createMockDbcInfo();
      const html = renderDbcMessagesHtml(dbcInfo, null);

      expect(html).toContain('EngineData');
      expect(html).toContain('VehicleSpeed');
      expect(html).toContain('BrakeStatus');
      expect(html).toContain('data-id="256"'); // 0x100
      expect(html).toContain('data-id="257"'); // 0x101
    });

    it('should mark selected message', () => {
      const dbcInfo = createMockDbcInfo();
      const html = renderDbcMessagesHtml(dbcInfo, 0x100);

      expect(html).toMatch(/class="cv-list-item selected".*data-id="256"/);
    });

    it('should show "No DBC file loaded" when no DBC info', () => {
      const html = renderDbcMessagesHtml(null, null);
      expect(html).toContain('No DBC file loaded');
    });

    it('should show "No DBC file loaded" when empty messages', () => {
      const emptyDbcInfo = { ...createMockDbcInfo(), messages: [] };
      const html = renderDbcMessagesHtml(emptyDbcInfo, null);
      expect(html).toContain('No DBC file loaded');
    });

    it('should include message metadata', () => {
      const dbcInfo = createMockDbcInfo();
      const html = renderDbcMessagesHtml(dbcInfo, null);

      expect(html).toContain('DLC: 8');
      expect(html).toContain('2 signals');
      expect(html).toContain('TX: ECU');
    });
  });

  describe('renderDbcSignalsHtml', () => {
    it('should render signal cards', () => {
      const msg = createMockDbcInfo().messages[0]; // EngineData
      const html = renderDbcSignalsHtml(msg);

      expect(html).toContain('EngineRPM');
      expect(html).toContain('EngineTemp');
      expect(html).toContain('Start Bit');
      expect(html).toContain('Length');
      expect(html).toContain('Factor');
      expect(html).toContain('Offset');
    });

    it('should show signal properties', () => {
      const msg: MessageInfo = {
        id: 0x100,
        name: 'Test',
        dlc: 8,
        sender: 'ECU',
        signals: [{
          name: 'TestSignal',
          start_bit: 8,
          length: 16,
          byte_order: 'little_endian',
          is_signed: true,
          factor: 0.1,
          offset: -40,
          min: -40,
          max: 215,
          unit: 'C',
        }],
      };
      const html = renderDbcSignalsHtml(msg);

      expect(html).toContain('8'); // start_bit
      expect(html).toContain('16 bits'); // length
      expect(html).toContain('0.1'); // factor
      expect(html).toContain('-40'); // offset and min
      expect(html).toContain('215'); // max
      expect(html).toContain('C'); // unit
    });

    it('should show "No signals defined" for message without signals', () => {
      const msg: MessageInfo = {
        id: 0x100,
        name: 'Empty',
        dlc: 8,
        sender: 'ECU',
        signals: [],
      };
      const html = renderDbcSignalsHtml(msg);
      expect(html).toContain('No signals defined for this message');
    });
  });

  describe('getDbcMessageSubtitle', () => {
    it('should format message subtitle', () => {
      const msg: MessageInfo = {
        id: 0x100,
        name: 'EngineData',
        dlc: 8,
        sender: 'ECU',
        signals: [],
      };
      const subtitle = getDbcMessageSubtitle(msg);

      expect(subtitle).toContain('ID: 0x100');
      expect(subtitle).toContain('DLC: 8');
      expect(subtitle).toContain('TX: ECU');
    });

    it('should omit TX when no sender', () => {
      const msg: MessageInfo = {
        id: 0x200,
        name: 'Test',
        dlc: 4,
        sender: '',
        signals: [],
      };
      const subtitle = getDbcMessageSubtitle(msg);

      expect(subtitle).toBe('ID: 0x200 | DLC: 4');
    });
  });

  describe('renderInterfaceOptions', () => {
    it('should render interface options with placeholder', () => {
      const html = renderInterfaceOptions(['can0', 'vcan0']);

      expect(html).toContain('<option value="">Select CAN interface...</option>');
      expect(html).toContain('<option value="can0">can0</option>');
      expect(html).toContain('<option value="vcan0">vcan0</option>');
    });

    it('should handle empty interfaces', () => {
      const html = renderInterfaceOptions([]);
      expect(html).toBe('<option value="">Select CAN interface...</option>');
    });
  });
});
