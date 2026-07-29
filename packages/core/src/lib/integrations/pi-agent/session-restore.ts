import type { RuntimeLLMConfig } from './llm-config';
import { extractDisplayContent } from './display-content';
import type { ProjectContext } from './types';

export const AGENT_SESSION_RESTORE_CONTRACT_VERSION = 1 as const;

export type RestoreAgentEntryType = 'skill' | 'agent' | 'role-agent';

export type RestoreAgentSessionErrorCode =
  | 'NOT_FOUND'
  | 'OWNERSHIP_MISMATCH'
  | 'CORRUPT_SESSION'
  | 'RESTORE_FAILED';

export interface RestoreAgentSessionRequest {
  sessionId: string;
  projectId: string;
  entryType?: RestoreAgentEntryType;
  entryId?: string;
}

export interface RestoreDisplayMessage {
  id?: string;
  role: 'user' | 'assistant' | 'tool' | 'toolResult';
  content: string;
  timestamp?: number;
}

export interface RestoreAgentSessionResult {
  contractVersion: typeof AGENT_SESSION_RESTORE_CONTRACT_VERSION;
  sessionId: string;
  projectContext: ProjectContext;
  messages: RestoreDisplayMessage[];
  agentType?: string;
  workingDirectory?: string;
  outputDir?: string;
  llmConfig?: RuntimeLLMConfig;
  runtime: {
    restored: boolean;
    resumable: boolean;
    warning?: string;
  };
}

export class RestoreAgentSessionError extends Error {
  readonly code: RestoreAgentSessionErrorCode;

  constructor(code: RestoreAgentSessionErrorCode, message: string) {
    super(message);
    this.name = 'RestoreAgentSessionError';
    this.code = code;
  }
}

type UnknownRecord = Record<string, unknown>;

const DISPLAY_ROLES = new Set<RestoreDisplayMessage['role']>([
  'user',
  'assistant',
  'tool',
  'toolResult',
]);

const SUPPORTED_AGENT_TYPES: Record<Exclude<RestoreAgentEntryType, 'agent'>, ReadonlySet<string>> = {
  skill: new Set(['skill']),
  'role-agent': new Set(['role-agent']),
};

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readRequiredString(
  record: UnknownRecord,
  field: string,
  errorMessage: string,
): string {
  const value = record[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RestoreAgentSessionError('CORRUPT_SESSION', errorMessage);
  }
  return value;
}

function isInternalMessage(message: UnknownRecord, content: string): boolean {
  if (content.trimStart().startsWith('[Internal Completion Recovery]')) {
    return true;
  }

  const metadata = message['metadata'];
  if (!isRecord(metadata)) {
    return false;
  }

  return metadata['internal'] === true
    || metadata['hidden'] === true
    || metadata['recoveryOnly'] === true
    || metadata['visibility'] === 'internal';
}

function mapDisplayMessage(message: unknown): RestoreDisplayMessage | null {
  if (!isRecord(message)) {
    throw new RestoreAgentSessionError(
      'CORRUPT_SESSION',
      'Session contains an invalid message.',
    );
  }

  const role = message['role'];
  if (role === 'system') {
    return null;
  }
  if (typeof role !== 'string' || !DISPLAY_ROLES.has(role as RestoreDisplayMessage['role'])) {
    throw new RestoreAgentSessionError(
      'CORRUPT_SESSION',
      'Session contains an unsupported message role.',
    );
  }

  const rawContent = message['content'];
  if (typeof rawContent !== 'string' && !Array.isArray(rawContent)) {
    throw new RestoreAgentSessionError(
      'CORRUPT_SESSION',
      'Session contains an invalid message body.',
    );
  }

  const content = extractDisplayContent(rawContent);
  if (!content || isInternalMessage(message, content)) {
    return null;
  }

  const id = message['id'];
  const timestamp = message['timestamp'];
  if (id !== undefined && typeof id !== 'string') {
    throw new RestoreAgentSessionError(
      'CORRUPT_SESSION',
      'Session contains an invalid message id.',
    );
  }
  if (timestamp !== undefined && (typeof timestamp !== 'number' || !Number.isFinite(timestamp))) {
    throw new RestoreAgentSessionError(
      'CORRUPT_SESSION',
      'Session contains an invalid message timestamp.',
    );
  }
  const normalizedId = typeof id === 'string' ? id : undefined;

  return {
    ...(normalizedId ? { id: normalizedId } : {}),
    role: role as RestoreDisplayMessage['role'],
    content,
    ...(typeof timestamp === 'number' ? { timestamp } : {}),
  };
}

export function mapSessionDisplayMessages(messages: unknown): RestoreDisplayMessage[] {
  if (!Array.isArray(messages)) {
    throw new RestoreAgentSessionError(
      'CORRUPT_SESSION',
      'Session messages are missing or invalid.',
    );
  }

  return messages
    .map(mapDisplayMessage)
    .filter((message): message is RestoreDisplayMessage => message !== null);
}

function expectedProjectId(request: RestoreAgentSessionRequest): string {
  if (request.entryType === 'skill' && request.entryId) {
    return `skill-${request.entryId}`;
  }
  if (
    (request.entryType === 'agent' || request.entryType === 'role-agent')
    && request.entryId
  ) {
    return request.entryId;
  }
  return request.projectId;
}

export function assertSessionOwnership(
  session: unknown,
  request: RestoreAgentSessionRequest,
): asserts session is UnknownRecord {
  if (!isRecord(session)) {
    throw new RestoreAgentSessionError('CORRUPT_SESSION', 'Session payload is invalid.');
  }

  const projectContext = session['projectContext'];
  if (!isRecord(projectContext)) {
    throw new RestoreAgentSessionError(
      'CORRUPT_SESSION',
      'Session project context is missing.',
    );
  }

  const sessionProjectId = readRequiredString(
    projectContext,
    'projectId',
    'Session project identity is missing.',
  );
  const requiredProjectId = expectedProjectId(request);
  if (
    request.projectId !== requiredProjectId
    || sessionProjectId !== request.projectId
  ) {
    throw new RestoreAgentSessionError(
      'OWNERSHIP_MISMATCH',
      'Session does not belong to the requested project or entry.',
    );
  }

  const explicitEntryType = projectContext['entryType'];
  const explicitEntryId = projectContext['entryId'];
  if (
    request.entryType
    && explicitEntryType !== undefined
    && explicitEntryType !== request.entryType
  ) {
    throw new RestoreAgentSessionError(
      'OWNERSHIP_MISMATCH',
      'Session does not belong to the requested entry type.',
    );
  }
  if (
    request.entryId
    && explicitEntryId !== undefined
    && explicitEntryId !== request.entryId
  ) {
    throw new RestoreAgentSessionError(
      'OWNERSHIP_MISMATCH',
      'Session does not belong to the requested entry.',
    );
  }

  if (request.entryType) {
    const agentType = session['agentType'];
    const agentTypeMatches = request.entryType === 'agent'
      ? typeof agentType === 'string' && agentType !== 'skill' && agentType !== 'role-agent'
      : typeof agentType === 'string' && SUPPORTED_AGENT_TYPES[request.entryType].has(agentType);
    if (
      !agentTypeMatches
    ) {
      throw new RestoreAgentSessionError(
        'OWNERSHIP_MISMATCH',
        'Session Agent type does not match the requested entry.',
      );
    }
  }
}

function validateOptionalSchemaVersion(session: UnknownRecord): void {
  const schemaVersion = session['schemaVersion'];
  if (
    schemaVersion !== undefined
    && schemaVersion !== 1
    && schemaVersion !== '1'
    && schemaVersion !== '1.0'
  ) {
    throw new RestoreAgentSessionError(
      'CORRUPT_SESSION',
      'Session schema version is not supported.',
    );
  }
}

function readProjectContext(session: UnknownRecord): ProjectContext {
  const rawContext = session['projectContext'];
  if (!isRecord(rawContext)) {
    throw new RestoreAgentSessionError(
      'CORRUPT_SESSION',
      'Session project context is missing.',
    );
  }

  const projectId = readRequiredString(
    rawContext,
    'projectId',
    'Session project identity is missing.',
  );
  const optionalString = (field: string): string | undefined => {
    const value = rawContext[field];
    if (value === undefined) return undefined;
    if (typeof value !== 'string') {
      throw new RestoreAgentSessionError(
        'CORRUPT_SESSION',
        `Session project context field "${field}" is invalid.`,
      );
    }
    return value;
  };

  return {
    projectId,
    ...(optionalString('ontologyId') ? { ontologyId: optionalString('ontologyId') } : {}),
    ...(optionalString('currentPath') ? { currentPath: optionalString('currentPath') } : {}),
    ...(optionalString('projectName') ? { projectName: optionalString('projectName') } : {}),
    ...(optionalString('userId') ? { userId: optionalString('userId') } : {}),
    ...(optionalString('outputDir') ? { outputDir: optionalString('outputDir') } : {}),
  };
}

function readRuntimeLLMConfig(session: UnknownRecord): RuntimeLLMConfig | undefined {
  const llmConfig = session['llmConfig'];
  if (llmConfig === undefined) return undefined;
  if (!isRecord(llmConfig)) {
    throw new RestoreAgentSessionError(
      'CORRUPT_SESSION',
      'Session LLM configuration is invalid.',
    );
  }
  return { ...llmConfig } as RuntimeLLMConfig;
}

export function createRestoreAgentSessionResult(
  session: unknown,
  request: RestoreAgentSessionRequest,
): RestoreAgentSessionResult {
  assertSessionOwnership(session, request);
  validateOptionalSchemaVersion(session);

  const sessionId = readRequiredString(session, 'sessionId', 'Session identity is missing.');
  if (sessionId !== request.sessionId) {
    throw new RestoreAgentSessionError(
      'OWNERSHIP_MISMATCH',
      'Session identity does not match the restore request.',
    );
  }

  const projectContext = readProjectContext(session);
  const messages = mapSessionDisplayMessages(session['messages']);
  const agentType = session['agentType'];
  if (agentType !== undefined && typeof agentType !== 'string') {
    throw new RestoreAgentSessionError(
      'CORRUPT_SESSION',
      'Session Agent type is invalid.',
    );
  }
  const normalizedAgentType = typeof agentType === 'string' ? agentType : undefined;

  const llmConfig = readRuntimeLLMConfig(session);
  return {
    contractVersion: AGENT_SESSION_RESTORE_CONTRACT_VERSION,
    sessionId,
    projectContext,
    messages,
    ...(normalizedAgentType ? { agentType: normalizedAgentType } : {}),
    ...(projectContext.currentPath ? { workingDirectory: projectContext.currentPath } : {}),
    ...(projectContext.outputDir ? { outputDir: projectContext.outputDir } : {}),
    ...(llmConfig ? { llmConfig } : {}),
    runtime: {
      restored: true,
      resumable: true,
    },
  };
}

export function toRestoreAgentSessionError(error: unknown): RestoreAgentSessionError {
  if (error instanceof RestoreAgentSessionError) {
    return error;
  }

  if (isRecord(error)) {
    const code = error['code'];
    if (code === 'NOT_FOUND') {
      return new RestoreAgentSessionError('NOT_FOUND', 'Session was not found.');
    }
    if (code === 'OWNERSHIP_MISMATCH') {
      return new RestoreAgentSessionError(
        'OWNERSHIP_MISMATCH',
        'Session does not belong to the requested project or entry.',
      );
    }
    if (code === 'CORRUPT_SESSION') {
      return new RestoreAgentSessionError('CORRUPT_SESSION', 'Session data is invalid.');
    }
  }

  return new RestoreAgentSessionError('RESTORE_FAILED', 'Session restore failed.');
}
