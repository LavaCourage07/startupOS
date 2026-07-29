import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

type JsonObject = Record<string, unknown>;

export type CapabilityStatus = 'supported' | 'unsupported';

export interface ContractCapability {
  status: CapabilityStatus;
  reason: string;
}

export interface PublicTaskStateEvent {
  name: string;
  payload: {
    reason?: string;
    state?: JsonObject;
    version?: number;
    widgetId?: string;
    [key: string]: unknown;
  };
}

export interface PublicBranchEntry {
  type: 'custom';
  customType: string;
  data: unknown;
}

export interface PublicToolResult {
  content?: Array<{ type?: string; text?: string }>;
  details?: JsonObject;
  isError?: boolean;
}

export interface PublicToolDefinition {
  name: string;
  parameters: JsonObject;
  execute(
    toolCallId: string,
    params: JsonObject,
    signal: AbortSignal,
    onUpdate: (update: unknown) => void,
    context: PublicExtensionContext,
  ): Promise<PublicToolResult>;
}

interface PublicExtensionContext {
  cwd: string;
  hasUI: boolean;
  sessionManager: {
    getBranch(): PublicBranchEntry[];
  };
  ui: {
    notify(message: string, level?: string): void;
    setStatus(key: string, value: string | undefined): void;
    setWidget(key: string, value: unknown): void;
  };
}

type LifecycleHandler = (
  event: JsonObject,
  context: PublicExtensionContext,
) => Promise<void> | void;

interface PublicPiTasksModule {
  TASK_STATE_EVENT: string;
  TASK_WIDGET_ID: string;
  default(api: PublicExtensionApi): void;
}

interface PublicRuntimeModule {
  AgentSession?: { prototype: JsonObject };
  AgentSessionRuntime?: { prototype: JsonObject };
  ExtensionRunner?: { prototype: JsonObject };
  [key: string]: unknown;
}

interface PublicExtensionApi {
  appendEntry(customType: string, data: unknown): void;
  events: {
    emit(name: string, payload: unknown): void;
  };
  on(name: string, handler: LifecycleHandler): void;
  registerCommand(name: string, command: unknown): void;
  registerTool(tool: PublicToolDefinition): void;
}

const ADAPTER_MANIFEST_PATH = path.resolve(
  process.cwd(),
  '../agent/package.json',
);
const HOST_INVOKE_METHODS = [
  'callTool',
  'executeRegisteredTool',
  'executeTool',
  'executeToolCall',
  'invokeExtensionTool',
  'invokeTool',
  'runTool',
] as const;
const REVISION_FIELDS = ['cursor', 'revision', 'sequence'] as const;

async function importPublicPackage<T>(packageName: string): Promise<T> {
  const requireFromAdapter = createRequire(ADAPTER_MANIFEST_PATH);
  try {
    const publicEntry = requireFromAdapter.resolve(packageName);
    return import(pathToFileURL(publicEntry).href) as Promise<T>;
  } catch (error) {
    if (
      typeof error !== 'object'
      || error === null
      || !('code' in error)
      || error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED'
    ) {
      throw error;
    }

    const packageRoot = path.join(
      path.dirname(ADAPTER_MANIFEST_PATH),
      'node_modules',
      ...packageName.split('/'),
    );
    const manifest = JSON.parse(
      fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
    ) as {
      exports?: { '.'?: { import?: string } };
      main?: string;
    };
    const publicImport = manifest.exports?.['.']?.import ?? manifest.main;
    if (!publicImport) {
      throw new Error(`${packageName} exposes no public import entry`);
    }
    return import(pathToFileURL(path.join(packageRoot, publicImport)).href) as Promise<T>;
  }
}

function publicPrototypeMethods(value: unknown): string[] {
  if (typeof value !== 'function' || !('prototype' in value)) {
    return [];
  }

  return Object.getOwnPropertyNames(value.prototype)
    .filter((name) => name !== 'constructor' && !name.startsWith('_'))
    .sort();
}

function hasOwn(object: unknown, property: string): boolean {
  return typeof object === 'object'
    && object !== null
    && Object.prototype.hasOwnProperty.call(object, property);
}

export class PublicPiTasksHarness {
  readonly commands = new Map<string, unknown>();
  readonly emittedEvents: PublicTaskStateEvent[] = [];
  readonly entries: PublicBranchEntry[] = [];
  readonly lifecycle = new Map<string, LifecycleHandler[]>();
  readonly tools = new Map<string, PublicToolDefinition>();

  private branch: PublicBranchEntry[];
  private readonly stateEventListeners = new Set<(event: PublicTaskStateEvent) => void>();
  private readonly context: PublicExtensionContext;

  private constructor(
    readonly extensionModule: PublicPiTasksModule,
    initialBranch: PublicBranchEntry[],
  ) {
    this.branch = [...initialBranch];
    this.context = {
      cwd: '/contract/pi-task-runtime-boundary',
      hasUI: false,
      sessionManager: {
        getBranch: (): PublicBranchEntry[] => [...this.branch],
      },
      ui: {
        notify: (): void => undefined,
        setStatus: (): void => undefined,
        setWidget: (): void => undefined,
      },
    };

    const api: PublicExtensionApi = {
      appendEntry: (customType, data) => {
        const entry: PublicBranchEntry = { type: 'custom', customType, data };
        this.entries.push(entry);
        this.branch.push(entry);
      },
      events: {
        emit: (name, payload) => {
          if (!hasOwn(payload, 'version')) {
            return;
          }
          const event = {
            name,
            payload: payload as PublicTaskStateEvent['payload'],
          };
          this.emittedEvents.push(event);
          this.stateEventListeners.forEach((listener) => listener(event));
        },
      },
      on: (name, handler) => {
        const handlers = this.lifecycle.get(name) ?? [];
        handlers.push(handler);
        this.lifecycle.set(name, handlers);
      },
      registerCommand: (name, command) => {
        this.commands.set(name, command);
      },
      registerTool: (tool) => {
        this.tools.set(tool.name, tool);
      },
    };

    extensionModule.default(api);
  }

  static async create(
    initialBranch: PublicBranchEntry[] = [],
  ): Promise<PublicPiTasksHarness> {
    const extensionModule = await importPublicPackage<PublicPiTasksModule>('pi-tasks');
    return new PublicPiTasksHarness(extensionModule, initialBranch);
  }

  setBranch(branch: PublicBranchEntry[]): void {
    this.branch = [...branch];
  }

  getBranch(): PublicBranchEntry[] {
    return [...this.branch];
  }

  async emitLifecycle(name: string): Promise<void> {
    for (const handler of this.lifecycle.get(name) ?? []) {
      await handler({}, this.context);
    }
  }

  async diagnosticRawExecute(
    toolName: string,
    params: JsonObject,
    hooks: {
      beforeToolCall(): void;
      afterToolCall(): void;
    },
  ): Promise<{
    result: PublicToolResult;
    standardHooksObserved: boolean;
  }> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Public tool is not registered: ${toolName}`);
    }

    void hooks;
    const result = await tool.execute(
      'diagnostic-call',
      params,
      new AbortController().signal,
      () => undefined,
      this.context,
    );

    return {
      result,
      standardHooksObserved: false,
    };
  }

  latestStateEvent(reason?: string): PublicTaskStateEvent | undefined {
    return [...this.emittedEvents]
      .reverse()
      .find((event) => reason === undefined || event.payload.reason === reason);
  }

  waitForStateEvent(
    predicate: (event: PublicTaskStateEvent) => boolean,
    timeoutMs: number,
  ): Promise<PublicTaskStateEvent> {
    const existing = this.emittedEvents.find(predicate);
    if (existing) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.stateEventListeners.delete(onEvent);
        reject(new Error(`pi-tasks state event timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      const onEvent = (event: PublicTaskStateEvent): void => {
        if (!predicate(event)) {
          return;
        }
        clearTimeout(timeout);
        this.stateEventListeners.delete(onEvent);
        resolve(event);
      };
      this.stateEventListeners.add(onEvent);
    });
  }
}

export const VALID_TASK_PLAN: JsonObject = {
  title: 'Public runtime boundary contract',
  objective: 'Verify public state replay without approving a mutation boundary',
  acceptance_criteria: ['The public state can be replayed from the current branch'],
  plan_steps: [
    {
      text: 'Capture one public state event from the registered extension',
      expectedOutput: 'A bounded public state event payload',
      allowedActions: ['inspect public state event'],
      evidenceRequired: true,
      decompositionStatus: 'atomic',
      granularityCheck: {
        isAtomic: true,
        reason: 'The diagnostic has one observable output',
        canBeDoneInOneAgentAction: true,
        hasSingleObservableOutput: true,
        hasSingleVerificationMethod: true,
        hasNoHiddenSubtasks: true,
      },
    },
  ],
  activate: true,
};

export const VALID_TASK_EVIDENCE: JsonObject = {
  task_id: 'T1',
  type: 'test',
  level: 'unit_test',
  summary: 'The public extension emitted a replayable state snapshot',
  passed: 'true',
  references: ['contract://pi-task-runtime-boundary/state-event'],
  criterion_ids: ['T1-AC1'],
  step_ids: ['T1-S1'],
  quality: {
    source: 'public-extension-contract',
    reproducible: true,
    verifier: 'tool',
    artifactRefs: ['contract://pi-task-runtime-boundary/state-event'],
    observedOutput: 'One bounded public state event was observed',
  },
};

export const VALID_TASK_BLOCKER: JsonObject = {
  task_id: 'T1',
  status: 'blocked',
  activity: 'Waiting for a public host invocation boundary',
  blocker: {
    reason: 'The stock runtime exposes no approved host invocation API',
    blockedBy: 'dependency',
    neededToUnblock: 'Provide a public invocation API or controlled adapter',
  },
};

export function inspectRevision(event: PublicTaskStateEvent): ContractCapability {
  const state = event.payload.state ?? {};
  const fields = REVISION_FIELDS.filter(
    (field) => hasOwn(event.payload, field) || hasOwn(state, field),
  );

  return fields.length === 0
    ? {
        status: 'unsupported',
        reason: 'Public state event v1 exposes no revision, sequence, or cursor.',
      }
    : {
        status: 'supported',
        reason: `Public state event exposes ${fields.join(', ')}.`,
      };
}

export function inspectForceCompletion(
  tool: PublicToolDefinition,
): ContractCapability {
  const properties = hasOwn(tool.parameters, 'properties')
    ? tool.parameters.properties
    : undefined;
  const exposesForce = hasOwn(properties, 'force_with_reason');

  return exposesForce
    ? {
        status: 'unsupported',
        reason:
          'Stock task_complete exposes force_with_reason, which Story 9.41 first release forbids.',
      }
    : {
        status: 'supported',
        reason: 'task_complete exposes no force completion parameter.',
      };
}

export async function inspectRuntimeBoundary(): Promise<{
  compactionTrigger: ContractCapability;
  hostInvocation: ContractCapability;
}> {
  const runtime = await importPublicPackage<PublicRuntimeModule>(
    '@earendil-works/pi-coding-agent',
  );
  const publicMethods = [
    ...publicPrototypeMethods(runtime.AgentSession),
    ...publicPrototypeMethods(runtime.AgentSessionRuntime),
    ...publicPrototypeMethods(runtime.ExtensionRunner),
  ];
  const exposedHostMethods = HOST_INVOKE_METHODS.filter(
    (name) => hasOwn(runtime, name) || publicMethods.includes(name),
  );
  const agentSessionMethods = publicPrototypeMethods(runtime.AgentSession);

  return {
    compactionTrigger: agentSessionMethods.includes('compact')
      ? {
          status: 'supported',
          reason: 'AgentSession exposes public compact().',
        }
      : {
          status: 'unsupported',
          reason: 'AgentSession exposes no public compact().',
        },
    hostInvocation: exposedHostMethods.length === 0
      ? {
          status: 'unsupported',
          reason:
            'No public host invocation API preserves schema validation, permission hooks, and tool lifecycle.',
        }
      : {
          status: 'supported',
          reason: `Public host methods found: ${exposedHostMethods.join(', ')}.`,
        },
  };
}

export function getTaskCount(event: PublicTaskStateEvent | undefined): number {
  const tasks = event?.payload.state?.tasks;
  return typeof tasks === 'object' && tasks !== null
    ? Object.keys(tasks).length
    : 0;
}

export function boundedContractResult(value: JsonObject): string {
  const serialized = JSON.stringify(value);
  if (serialized.length > 16_384) {
    throw new Error(`Contract result exceeds 16384 characters: ${serialized.length}`);
  }
  return serialized;
}
