/**
 * Message Decoder Types
 */

export interface BytePattern {
  byteIndex: number;
  min: number;
  max: number;
  uniqueValues: number;
  constantValue: number | null;
  isCounter: boolean;
  isBitfield: boolean;
  entropy: number;
}

export interface AnalysisResult {
  messageId: number;
  isExtended: boolean;
  frameCount: number;
  minDlc: number;
  maxDlc: number;
  avgIntervalMs: number;
  minIntervalMs: number;
  maxIntervalMs: number;
  bytePatterns: BytePattern[];
  potentialSignals: PotentialSignal[];
}

export interface PotentialSignal {
  name: string;
  startBit: number;
  length: number;
  isSigned: boolean;
  minValue: number;
  maxValue: number;
  confidence: number;
  type: SignalType;
}

export type SignalType = 'counter' | 'gauge' | 'bitfield' | 'constant' | 'unknown';
