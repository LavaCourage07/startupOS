/**
 * API Response Types
 *
 * Standardized API response format across all endpoints
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string; // ISO 8601
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Interview API request/response types
 */
export interface CreateInterviewRequest {
  projectId: string;
  skipOptionalQuestions?: boolean;
}

export interface UpdateInterviewRequest {
  answers: Record<string, unknown>;
}

export interface CompleteInterviewRequest {
  interviewId: string;
}

/**
 * Ontology API request/response types
 */
export interface GenerateOntologyRequest {
  interviewId?: string;
  projectId: string;
  answers?: {
    work_domain?: string;
    work_mode?: string;
    main_tasks?: string;
  };
}

export interface UpdateOntologyRequest {
  operations: Array<{
    type: 'add' | 'update' | 'delete';
    entityType: 'domain' | 'concept' | 'instance' | 'relation';
    data: unknown;
  }>;
}

export interface ConfirmOntologyRequest {
  ontologyId: string;
  confirmed: boolean;
}

export interface ChatRequest {
  ontologyId: string;
  message: string;
}

/**
 * Project metadata
 */
export interface ProjectMetadata {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Project API request/response types
 */
export interface CreateProjectRequest {
  name: string;
  description?: string;
  domain: string;
  type?: string;
  userId?: string;
  ontologyId?: string;
  status?: string;
  color?: string;
  icon?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  domain?: string;
  type?: string;
  status?: string;
  color?: string;
  icon?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Project list item type
 */
export interface ProjectListItem {
  id: string;
  name: string;
  description: string;
  domain: string;
  createdAt: number;
  lastModified: number;
  ontologySize: number;
  ontologyId: string;
  color: string;
  status: string;
}

/**
 * Skills API request/response types
 */
export interface SkillListItem {
  name: string;
  description: string;
  source: 'bundled' | 'user' | 'project';
  filePath: string;
  baseDir: string;
  disableModelInvocation: boolean;
}

export interface SkillDetail extends SkillListItem {
  content: string;
  frontmatter: {
    name?: string;
    description?: string;
    'disable-model-invocation'?: boolean;
    [key: string]: unknown;
  };
}

export interface SkillDiagnosticItem {
  type: 'warning' | 'error' | 'collision';
  message: string;
  path: string;
  collision?: {
    resourceType: string;
    name: string;
    winnerPath: string;
    loserPath: string;
  };
}

export interface ListSkillsResponse {
  skills: SkillListItem[];
  diagnostics: SkillDiagnosticItem[];
}

/**
 * Skill Execution API request/response types
 */
export interface SkillExecutionStartRequest {
  skillName: string;
  args?: string; // Arguments to pass to the skill
  sessionId?: string; // Optional session ID to associate with
}

export interface SkillExecutionStartResponse {
  executionId: string;
  skillName: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  sessionId?: string;
}

export interface SkillExecutionMessageRequest {
  content: string;
  role?: 'user' | 'assistant';
}

export interface SkillExecutionMessageResponse {
  message: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  };
  executionStatus?: {
    status: 'running' | 'completed' | 'failed';
    progress?: number;
  };
}

export interface SkillExecutionCompleteRequest {
  cancelled?: boolean;
}

export interface SkillExecutionCompleteResponse {
  success: boolean;
  status: 'completed' | 'cancelled' | 'failed';
  endedAt: string;
  summary?: {
    totalMessages: number;
    duration: number;
  };
}

export interface SkillExecutionTimelineItem {
  type: 'start' | 'message' | 'tool' | 'end' | 'error';
  timestamp: string;
  data?: {
    role?: 'user' | 'assistant';
    content?: string;
    toolName?: string;
    toolResult?: unknown;
    error?: string;
    status?: string;
  };
}

export interface SkillExecutionTimelineResponse {
  executionId: string;
  skillName: string;
  startedAt: string;
  status: 'running' | 'completed' | 'failed';
  endedAt?: string;
  timeline: SkillExecutionTimelineItem[];
}
