import type { CanFrame } from '../types';

/**
 * Detect the DLC for a CAN ID from loaded frames.
 *
 * This helps the DBC editor suggest the correct DLC when creating/editing
 * messages, based on actual frame data from MF4 files or live capture.
 *
 * @param frames - Array of CAN frames to search
 * @param canId - The CAN ID to find DLC for
 * @param isExtended - Whether to match extended (29-bit) CAN IDs (default: false)
 * @returns The detected DLC, or null if no matching frames found
 */
export function detectDlcFromFrames(
  frames: CanFrame[],
  canId: number,
  isExtended = false
): number | null {
  // Filter frames matching the CAN ID and extended flag
  const matchingFrames = frames.filter(
    (f) => f.can_id === canId && f.is_extended === isExtended
  );

  if (matchingFrames.length === 0) {
    return null;
  }

  // Count occurrences of each DLC
  const dlcCounts = new Map<number, number>();
  for (const frame of matchingFrames) {
    const count = dlcCounts.get(frame.dlc) || 0;
    dlcCounts.set(frame.dlc, count + 1);
  }

  // Return the most common DLC
  let maxCount = 0;
  let mostCommonDlc = matchingFrames[0].dlc;

  for (const [dlc, count] of dlcCounts) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonDlc = dlc;
    }
  }

  return mostCommonDlc;
}
