import type { AgentMessage } from '@originos/pi-agent-adapter';

export interface RuntimeWorkingSummary {
  currentTask?: string;
  failureReason?: string;
  doNotRepeat?: string;
}

type SyntheticSystemMessage = {
  role: 'system';
  content: Array<{
    type: 'text';
    text: string;
  }>;
};

function hasContent(message: AgentMessage): message is AgentMessage & { content: unknown[] } {
  return 'content' in message && Array.isArray((message as { content?: unknown }).content);
}

function getTextContent(message: AgentMessage): string {
  if (!hasContent(message)) return '';
  return message.content
    .filter((block: any) => block?.type === 'text' && typeof block.text === 'string')
    .map((block: any) => block.text as string)
    .join('\n')
    .trim();
}

function normalizeLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractFailureReason(text: string): string | undefined {
  const lines = text.split('\n').map((line) => normalizeLine(line)).filter(Boolean);
  for (const line of lines) {
    if (
      line.includes('失败原因') ||
      line.includes('Error:') ||
      line.includes('error:') ||
      line.includes('not found') ||
      line.includes('不存在')
    ) {
      return line;
    }
  }
  return undefined;
}

function extractDoNotRepeat(text: string): string | undefined {
  const lines = text.split('\n').map((line) => normalizeLine(line)).filter(Boolean);
  for (const line of lines) {
    if (
      line.includes('不要重复') ||
      line.includes('停止重复') ||
      line.includes('不再沿用') ||
      line.includes('换一种方式') ||
      line.includes('改为')
    ) {
      return line;
    }
  }
  return undefined;
}

export function buildRuntimeWorkingSummary(messages: AgentMessage[]): RuntimeWorkingSummary {
  const currentTask = [...messages]
    .reverse()
    .find((message) => message.role === 'user');
  const currentTaskText = currentTask ? normalizeLine(getTextContent(currentTask)).slice(0, 200) : undefined;

  let failureReason: string | undefined;
  let doNotRepeat: string | undefined;

  for (const message of [...messages].reverse()) {
    const text = getTextContent(message);
    if (!text) continue;

    if (!failureReason) {
      failureReason = extractFailureReason(text);
    }
    if (!doNotRepeat) {
      doNotRepeat = extractDoNotRepeat(text);
    }

    if (failureReason && doNotRepeat) {
      break;
    }
  }

  return {
    currentTask: currentTaskText,
    failureReason,
    doNotRepeat,
  };
}

export function createWorkingSummaryMessage(messages: AgentMessage[]): AgentMessage | null {
  const summary = buildRuntimeWorkingSummary(messages);
  if (!summary.currentTask && !summary.failureReason && !summary.doNotRepeat) {
    return null;
  }

  const lines = ['[Working Summary]'];
  if (summary.currentTask) {
    lines.push(`当前任务：${summary.currentTask}`);
  }
  if (summary.failureReason) {
    lines.push(`最近失败原因：${summary.failureReason}`);
  }
  if (summary.doNotRepeat) {
    lines.push(`禁止重复动作：${summary.doNotRepeat}`);
  }

  const message: SyntheticSystemMessage = {
    role: 'system',
    content: [
      {
        type: 'text',
        text: lines.join('\n'),
      },
    ],
  };

  return message as unknown as AgentMessage;
}
