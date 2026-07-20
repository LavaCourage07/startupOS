/**
 * Ontology Types
 * Story 1.3: Initial Ontology Structure Generation
 *
 * Three-layer structure: Domain -> Concept -> Instance
 */

// ============================================================================
// Legacy Types (Original domain/concept/instance structure)
// ============================================================================

/**
 * Legacy relation types between entities
 */
export type RelationType = 'dependency' | 'contains' | 'association' | 'inheritance';

/**
 * Domain entity (Top layer)
 */
export interface Domain {
  id: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * Concept entity (Middle layer)
 */
export interface Concept {
  id: string;
  domainId: string;
  name: string;
  type: string; // Concept type category
  attributes: Record<string, any>;
  description?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * Instance entity (Bottom layer)
 */
export interface Instance {
  id: string;
  conceptId: string;
  data: Record<string, any>;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * Relation between entities
 */
export interface Relation {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  metadata?: Record<string, any>;
  createdAt: string; // ISO 8601
}

/**
 * Complete Ontology structure
 */
export interface Ontology {
  id: string;
  projectId: string;
  name: string;
  domains: Domain[];
  concepts: Concept[];
  instances: Instance[];
  relations: Relation[];
  version: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * Ontology generation result from interview
 */
export interface OntologyGenerationResult {
  ontology: Ontology;
  generationTime: number; // in milliseconds
  source: 'interview' | 'manual' | 'ai_assisted';
}

/**
 * Ontology edit operation
 */
export interface OntologyEditOperation {
  type: 'add' | 'update' | 'delete';
  entityType: 'domain' | 'concept' | 'instance' | 'relation';
  entityId?: string;
  data: any;
}

/**
 * Ontology edit response
 */
export interface OntologyEditResponse {
  success: boolean;
  ontology: Ontology;
  errors?: string[];
}

/**
 * Chat history record for ontology editing
 */
export interface ChatHistoryRecord {
  id: string;
  timestamp: string; // ISO 8601
  role: 'user' | 'assistant' | 'system';
  content: string;
  relatedOntologyChanges?: OntologyEditOperation[];
}

/**
 * Chat conversation for ontology editing
 */
export interface OntologyChat {
  id: string;
  ontologyId: string;
  projectId: string;
  history: ChatHistoryRecord[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * Ontology confirmation state
 */
export type OntologyConfirmationStatus = 'pending' | 'confirmed' | 'editing';

/**
 * Ontology with confirmation status
 */
export interface OntologyWithStatus extends Ontology {
  confirmationStatus: OntologyConfirmationStatus;
}

// ============================================================================
// Ontology Skill Integration Types
// ============================================================================
// Based on: awesome-openclaw-skills-1/skills/ontology/references/schema.md
//
// These types represent the ontology skill's entity and relation model
// which uses a flexible typed knowledge graph approach.
// ============================================================================

/**
 * Ontology entity base type
 */
export interface OntologyEntity {
  id: string;
  type: string;
  properties: Record<string, unknown>;
  created: string; // ISO 8601 timestamp
  updated: string; // ISO 8601 timestamp
}

/**
 * Relation between ontology entities
 */
export interface OntologyRelation {
  from: string; // Entity ID
  rel: string;  // Relation type (e.g., has_owner, has_task, blocks)
  to: string;   // Entity ID
  properties?: Record<string, unknown>;
}

/**
 * Ontology entity types defined in the schema
 */
export type EntityType =
  | 'Person'
  | 'Organization'
  | 'Project'
  | 'Task'
  | 'Goal'
  | 'Event'
  | 'Location'
  | 'Document'
  | 'Message'
  | 'Thread'
  | 'Note'
  | 'Account'
  | 'Device'
  | 'Credential'
  | 'Action'
  | 'Policy';

/**
 * Relation types defined in the schema
 */
export type RelationKind =
  | 'owns'
  | 'has_owner'
  | 'assigned_to'
  | 'has_task'
  | 'has_goal'
  | 'member_of'
  | 'part_of'
  | 'blocks'
  | 'depends_on'
  | 'requires'
  | 'mentions'
  | 'references'
  | 'follows_up'
  | 'attendee_of'
  | 'located_at';

// ============================================================================
// Entity Properties (Typed based on schema)
// ============================================================================

/**
 * Person entity properties
 */
export interface PersonProperties {
  name: string;
  email?: string;
  phone?: string;
  organization?: string; // ref to Organization
  notes?: string;
  tags?: string[];
  role?: string; // Project-specific role (not in original schema but useful)
  [key: string]: unknown;
}

/**
 * Organization entity properties
 */
export interface OrganizationProperties {
  name: string;
  type?: 'company' | 'team' | 'community' | 'government' | 'other';
  website?: string;
  members?: string[]; // refs to Person
}

/**
 * Project entity properties
 */
export interface ProjectProperties {
  name: string;
  description?: string;
  status: 'planning' | 'active' | 'paused' | 'completed' | 'archived';
  owner?: string; // ref to Person
  team?: string[]; // refs to Person
  goals?: string[]; // refs to Goal
  start_date?: string; // ISO 8601 date
  end_date?: string; // ISO 8601 date
  tags?: string[];
  [key: string]: unknown;
}

/**
 * Task entity properties
 */
export interface TaskProperties {
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: string; // ref to Person
  project?: string; // ref to Project
  due?: string; // ISO 8601 datetime
  estimate_hours?: number;
  blockers?: string[]; // refs to Task
  tags?: string[];
  [key: string]: unknown;
}

/**
 * Goal entity properties
 */
export interface GoalProperties {
  description: string;
  target_date?: string; // ISO 8601 date
  status: 'active' | 'achieved' | 'abandoned';
  metrics?: Array<Record<string, unknown>>;
  key_results?: string[];
  [key: string]: unknown;
}

/**
 * Event entity properties
 */
export interface EventProperties {
  title: string;
  description?: string;
  start: string; // ISO 8601 datetime
  end?: string; // ISO 8601 datetime
  location?: string; // ref to Location
  attendees?: string[]; // refs to Person
  recurrence?: Record<string, unknown>; // iCal RRULE format
  status?: 'confirmed' | 'tentative' | 'cancelled';
  reminders?: Array<Record<string, unknown>>;
}

/**
 * Location entity properties
 */
export interface LocationProperties {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  coordinates?: { lat: number; lng: number };
  timezone?: string;
}

/**
 * Document entity properties
 */
export interface DocumentProperties {
  title: string;
  path?: string; // Local file path
  url?: string; // Remote URL
  mime_type?: string;
  summary?: string;
  content_hash?: string;
  tags?: string[];
}

/**
 * Message entity properties
 */
export interface MessageProperties {
  content: string;
  sender: string; // ref to Person
  recipients: string[]; // refs to Person
  thread?: string; // ref to Thread
  timestamp: string; // ISO 8601 datetime
  platform?: string; // email, slack, whatsapp, etc.
  external_id?: string;
}

/**
 * Thread entity properties
 */
export interface ThreadProperties {
  subject: string;
  participants: string[]; // refs to Person
  messages: string[]; // refs to Message
  status?: 'active' | 'archived';
  last_activity?: string; // ISO 8601 datetime
}

/**
 * Note entity properties
 */
export interface NoteProperties {
  content: string;
  title?: string;
  tags?: string[];
  refs?: string[]; // Links to any entity
  created: string; // ISO 8601 datetime
}

/**
 * Account entity properties
 */
export interface AccountProperties {
  service: string; // github, gmail, aws, etc.
  username: string;
  url?: string;
  credential_ref?: string; // ref to Credential
}

/**
 * Device entity properties
 */
export interface DeviceProperties {
  name: string;
  type: 'computer' | 'phone' | 'tablet' | 'server' | 'iot' | 'other';
  os?: string;
  identifiers?: Record<string, unknown>; // {mac, serial, etc.}
  owner?: string; // ref to Person
}

/**
 * Credential entity properties
 */
export interface CredentialProperties {
  service: string;
  secret_ref: string; // Reference to secret store (e.g., "keychain:github-token")
  expires?: string; // ISO 8601 datetime
  scope?: string[];
}

/**
 * Action entity properties
 */
export interface ActionProperties {
  type: string; // create, update, delete, send, etc.
  target: string; // ref to any Entity
  timestamp: string; // ISO 8601 datetime
  actor?: string; // ref to Person or Agent
  outcome?: 'success' | 'failure' | 'pending';
  details?: Record<string, unknown>;
}

/**
 * Policy entity properties
 */
export interface PolicyProperties {
  scope: string; // What this policy applies to
  rule: string; // The constraint in natural language or code
  enforcement: 'block' | 'warn' | 'log';
  enabled: boolean;
}
