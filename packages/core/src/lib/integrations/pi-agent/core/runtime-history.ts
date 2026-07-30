import type { AgentMessage } from '@originos/pi-agent-adapter';
import type {
  Api,
  AssistantMessage,
  Model,
} from '@originos/pi-agent-adapter/ai';

export interface PersistedRuntimeMessage {
  role: 'user' | 'assistant' | 'system' | 'tool' | 'toolResult';
  content: string;
  timestamp: number;
}

export type RestorableRuntimeApi =
  | 'anthropic-messages'
  | 'openai-completions'
  | 'google'
  | 'azure-openai-responses';

function isRestorableRuntimeApi(api: Api): api is RestorableRuntimeApi {
  return api === 'anthropic-messages'
    || api === 'openai-completions'
    || api === 'google'
    || api === 'azure-openai-responses';
}

export function toRestorableRuntimeModel(
  model: Model<Api>,
): Model<RestorableRuntimeApi> {
  if (!isRestorableRuntimeApi(model.api)) {
    throw new Error(`不支持恢复消息的 Runtime API: ${model.api}`);
  }

  return {
    ...model,
    api: model.api,
  };
}

function createRestoredUsage(): AssistantMessage['usage'] {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
  };
}

export function mapPersistedMessagesForRuntime(
  messages: readonly PersistedRuntimeMessage[],
  model: Model<RestorableRuntimeApi>,
): AgentMessage[] {
  return messages.flatMap((message): AgentMessage[] => {
    if (message.role === 'system') {
      return [];
    }
    if (message.role === 'user') {
      return [{
        role: 'user',
        content: message.content,
        timestamp: message.timestamp,
      }];
    }
    if (message.role === 'assistant') {
      return [{
        role: 'assistant',
        content: [{ type: 'text', text: message.content }],
        api: model.api,
        provider: model.provider,
        model: model.id,
        usage: createRestoredUsage(),
        stopReason: 'stop',
        timestamp: message.timestamp,
      }];
    }

    const label = message.role === 'toolResult' ? 'Tool result' : 'Tool output';
    return [{
      role: 'user',
      content: `[${label} from restored history]\n${message.content}`,
      timestamp: message.timestamp,
    }];
  });
}
