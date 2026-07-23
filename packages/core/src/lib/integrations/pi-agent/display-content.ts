export interface ExtractDisplayContentOptions {
  /**
   * When true, fall back to a single thinking block if no text blocks exist.
   * Used to keep assistant turns renderable even when an upstream provider
   * incorrectly emits only thinking content for a completed turn.
   */
  allowThinkingFallback?: boolean;
}

function joinBlockTexts(
  content: unknown[],
  type: 'text' | 'thinking',
): string {
  const text = content
    .filter((block): block is { type: 'text' | 'thinking'; text?: string; thinking?: string } =>
      !!block &&
      typeof block === 'object' &&
      (block as { type?: unknown }).type === type
    )
    .map((block) => {
      if (type === 'text') {
        return typeof block.text === 'string' ? block.text : '';
      }
      return typeof block.thinking === 'string' ? block.thinking : '';
    })
    .filter(Boolean)
    .join('');
  return type === 'text' ? stripHiddenReasoning(text) : text;
}

export function stripHiddenReasoning(text: string): string {
  return text
    .replace(/<think(?:ing)?\b[^>]*>[\s\S]*?<\/think(?:ing)?>/gi, '')
    .trim();
}

export function extractDisplayContent(
  content: unknown,
  options: ExtractDisplayContentOptions = {},
): string {
  if (typeof content === 'string') {
    return stripHiddenReasoning(content);
  }
  if (!Array.isArray(content)) {
    return '';
  }

  const text = joinBlockTexts(content, 'text');
  if (text) {
    return text;
  }

  if (!options.allowThinkingFallback) {
    return '';
  }

  const thinkingBlocks = content.filter(
    (block): block is { type: 'thinking'; thinking?: string } =>
      !!block &&
      typeof block === 'object' &&
      (block as { type?: unknown }).type === 'thinking'
  );

  if (thinkingBlocks.length !== 1) {
    return '';
  }

  const thinkingBlock = thinkingBlocks[0];
  if (!thinkingBlock) {
    return '';
  }

  return typeof thinkingBlock.thinking === 'string'
    ? thinkingBlock.thinking
    : '';
}

export interface AgentDisplayMessageLike {
  role?: unknown;
  content?: unknown;
  metadata?: unknown;
}

export interface SanitizedAgentDisplayMessage {
  role?: unknown;
  content: string;
  metadata?: unknown;
}

export function sanitizeAgentDisplayContent(content: unknown): string {
  return extractDisplayContent(content);
}

export function sanitizeAgentDisplayMessage<T extends AgentDisplayMessageLike>(
  message: T,
): T & SanitizedAgentDisplayMessage {
  const { metadata: _metadata, ...rest } = message;
  return {
    ...rest,
    content: sanitizeAgentDisplayContent(message.content),
  } as T & SanitizedAgentDisplayMessage;
}
