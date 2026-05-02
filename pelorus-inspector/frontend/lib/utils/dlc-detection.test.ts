import { describe, it, expect } from 'vitest';
import type { CanFrame } from '../types';
import { detectDlcFromFrames } from './dlc-detection';

describe('detectDlcFromFrames', () => {
  const createFrame = (canId: number, dlc: number, data?: number[]): CanFrame => ({
    timestamp: 0,
    channel: 'can0',
    can_id: canId,
    is_extended: false,
    is_fd: false,
    brs: false,
    esi: false,
    dlc,
    data: data || new Array(dlc).fill(0),
  });

  it('should return null when no frames exist', () => {
    const result = detectDlcFromFrames([], 1024);
    expect(result).toBeNull();
  });

  it('should return null when no frames match the CAN ID', () => {
    const frames = [
      createFrame(256, 8),
      createFrame(512, 8),
    ];
    const result = detectDlcFromFrames(frames, 1024);
    expect(result).toBeNull();
  });

  it('should return DLC from single matching frame', () => {
    const frames = [
      createFrame(256, 8),
      createFrame(1024, 6),  // NewMessage with DLC=6
      createFrame(512, 8),
    ];
    const result = detectDlcFromFrames(frames, 1024);
    expect(result).toBe(6);
  });

  it('should return consistent DLC when multiple frames have same DLC', () => {
    const frames = [
      createFrame(1024, 6),
      createFrame(1024, 6),
      createFrame(1024, 6),
    ];
    const result = detectDlcFromFrames(frames, 1024);
    expect(result).toBe(6);
  });

  it('should return most common DLC when frames have different DLCs', () => {
    // Edge case: frames might have varying DLCs (shouldn't happen but handle gracefully)
    const frames = [
      createFrame(1024, 6),
      createFrame(1024, 6),
      createFrame(1024, 6),
      createFrame(1024, 8),  // One outlier
    ];
    const result = detectDlcFromFrames(frames, 1024);
    expect(result).toBe(6);  // Most common
  });

  it('should handle extended CAN IDs', () => {
    const frames = [
      { ...createFrame(1024, 6), is_extended: true },
    ];
    const result = detectDlcFromFrames(frames, 1024, true);
    expect(result).toBe(6);
  });

  it('should distinguish between standard and extended IDs', () => {
    const frames = [
      { ...createFrame(1024, 8), is_extended: false },  // Standard
      { ...createFrame(1024, 6), is_extended: true },   // Extended
    ];

    // Standard ID 1024 should return 8
    expect(detectDlcFromFrames(frames, 1024, false)).toBe(8);

    // Extended ID 1024 should return 6
    expect(detectDlcFromFrames(frames, 1024, true)).toBe(6);
  });

  // This is the actual bug scenario from sample.dbc/sample.mf4
  it('should detect DLC=6 for NewMessage (ID 1024) from MF4 frames', () => {
    // Simulating frames as they would be loaded from sample.mf4
    const frames = [
      createFrame(256, 8),   // EngineData
      createFrame(512, 8),   // TransmissionData
      createFrame(768, 6),   // BrakeData
      createFrame(1024, 6),  // NewMessage - actual DLC is 6!
    ];

    const detectedDlc = detectDlcFromFrames(frames, 1024);

    // The editor should use this DLC (6) instead of defaulting to 8
    expect(detectedDlc).toBe(6);
  });
});
