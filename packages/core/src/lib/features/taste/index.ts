/**
 * TASTE Module - Public API
 *
 * Core exports for the Taste Engineering layer.
 */

// Types and schemas
export type {
  TasteContext,
  TasteJudgment,
  TasteFeedback,
  TasteMemory,
  TASTEProfile,
  CultureLayerDetection,
  OwnershipLevel,
  TasteAlignmentMetrics,
  OwnershipPromotionCriteria,
} from './taste-schema';

export {
  DEFAULT_PROMOTION_CRITERIA,
} from './taste-schema';

// Database and graph
export {
  ContextMemoryDB,
  createMemoryDB,
} from './context-memory-db';

export {
  MemoryGraph,
} from './memory-graph';

// Validators and factories
export {
  validateTasteContext,
  validateTasteJudgment,
  validateTasteFeedback,
  validateTasteMemory,
  validateTASTEProfile,
  validateCultureLayerDetection,
  validateECOState,
  validateTasteAlignmentMetrics,
  createTasteMemory,
  createFeedback,
  createJudgment,
  createContext,
} from './taste-schema';
