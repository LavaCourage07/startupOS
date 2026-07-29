import { describe, expect, it } from 'vitest';
import type { Model } from '@originos/pi-agent-adapter/ai';
import { mapPersistedMessagesForRuntime } from '../runtime-history';

const commonModelFields = {
  name: 'Runtime restore test model',
  baseUrl: 'https://example.test',
  reasoning: false,
  input: ['text'] as const,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  },
  contextWindow: 128_000,
  maxTokens: 8_192,
};

const openAIModel: Model<'openai-completions'> = {
  ...commonModelFields,
  id: 'gpt-runtime',
  api: 'openai-completions',
  provider: 'openai',
  input: [...commonModelFields.input],
};

const anthropicModel: Model<'anthropic-messages'> = {
  ...commonModelFields,
  id: 'claude-runtime',
  api: 'anthropic-messages',
  provider: 'anthropic',
  input: [...commonModelFields.input],
};

const persistedHistory = [
  {
    role: 'user' as const,
    content: '历史用户问题',
    timestamp: 10,
  },
  {
    role: 'assistant' as const,
    content: '历史助手回答',
    timestamp: 20,
  },
];

describe.each([
  ['OpenAI', openAIModel],
  ['Anthropic', anthropicModel],
])('Runtime history restore mapping for %s', (_name, model) => {
  it('derives assistant api, provider, and model from the active runtime model', () => {
    const messages = mapPersistedMessagesForRuntime(persistedHistory, model);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      role: 'user',
      content: '历史用户问题',
    });
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      api: model.api,
      provider: model.provider,
      model: model.id,
      content: [{ type: 'text', text: '历史助手回答' }],
    });
  });
});
