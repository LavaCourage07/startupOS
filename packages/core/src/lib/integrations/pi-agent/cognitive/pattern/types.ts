/**
 * Pattern 模块类型定义
 */

import type { CorrectionSignal } from '../../../../shared/cognitive';

export type { CorrectionSignal };

export type PatternPolarity = 'positive' | 'negative';

export interface PatternIngestPayload {
  polarity: PatternPolarity;
  scene: string;
  toolChain: string[];
  resultSummary?: string;
  failureReason?: string;
  userFeedback?: string;
  correctionStrength?: CorrectionSignal['strength'];
}
