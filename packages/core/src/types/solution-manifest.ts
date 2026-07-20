/**
 * Solution Manifest split types
 *
 * Defines the structure of the three-file versioned solution:
 * - {version}/manifest.json   — metadata, modeling, execution summary
 * - {version}/agents.json     — agent specifications
 * - {version}/skills.json     — full skill definitions with I/O contracts
 */

import type {
  ModelingDimension,
  SolutionStatus,
  OntologyObjectOperation,
  AgentCollaboration,
  AgentSkill,
} from './solution';

// ============================================================================
// 1. manifest.json — lightweight metadata
// ============================================================================

export interface SolutionManifestCore {
  version: '1.0.0';
  status: SolutionStatus;
  solutionVersion: string;
  modeling: {
    dimension: ModelingDimension;
    dimensionName: string;
    rationale?: string;
    businessModelSummary?: Record<string, unknown>;
  };
  executionMode: 'Workflow' | 'System';
  changesFromPrevious: string[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 2. agents.json — agent specifications
// ============================================================================

export interface SolutionAgentSpec {
  id: string;
  name: string;
  type: 'agent' | 'role-agent';
  responsibility: string;
  businessDomain: string;
  derivedFrom: string[];
  ontologyOperations: OntologyObjectOperation[];
  skills: string[]; // skill code references
  collaborations: AgentCollaboration[];
}

export interface SolutionAgentsFile {
  version: '1.0.0';
  solutionVersion: string;
  agents: SolutionAgentSpec[];
}

// ============================================================================
// 3. skills.json — full skill definitions
// ============================================================================

export interface SolutionSkillsFile {
  version: '1.0.0';
  solutionVersion: string;
  skills: AgentSkill[];
}

// ============================================================================
// 4. Bundle (merged view for API / client consumption)
// ============================================================================

export interface SolutionBundle {
  manifest: SolutionManifestCore;
  agents: SolutionAgentSpec[];
  skills: AgentSkill[];
}
