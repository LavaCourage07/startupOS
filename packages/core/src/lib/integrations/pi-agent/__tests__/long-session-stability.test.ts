import { describe, expect, it } from 'vitest';
import type { AgentMessage } from '@mariozechner/agent';
import { compressRecentTrace } from '../recent-trace-compression';
import { LoopDetector } from '../tools/loop-detector';
import { createWorkingSummaryMessage } from '../runtime-working-summary';

function textMessage(role: string, text: string): AgentMessage {
  return {
    role,
    content: [{ type: 'text', text }],
  } as AgentMessage;
}

describe('long-session stability', () => {
  it('preserves recent failure context instead of older plan history during compression', () => {
    const messages: AgentMessage[] = [];

    for (let i = 0; i < 14; i++) {
      messages.push(textMessage('user', `历史需求-${i}`));
    }

    messages.push(textMessage('assistant', '旧计划：继续沿用 read_file -> parse_doc -> write_report 工具链'));
    messages.push(textMessage('user', '请继续处理上次任务'));
    messages.push(textMessage('assistant', '准备继续旧计划'));
    messages.push({
      role: 'assistant',
      content: [{ type: 'toolCall', id: 'call-1', name: 'read_file', arguments: { path: 'old-plan.md' } }],
    } as AgentMessage);
    messages.push({
      role: 'toolResult',
      content: [{ type: 'text', text: 'Error: file not found' }],
      toolName: 'read_file',
      toolCallId: 'call-1',
    } as AgentMessage);
    messages.push(textMessage('assistant', '最近失败原因：old-plan.md 不存在，不要重复 read_file，同步改为请求用户补充路径'));
    messages.push(textMessage('user', '如果旧计划不可用，就换一种方式'));

    const result = compressRecentTrace(messages, {
      maxHistory: 12,
      keepRecent: 7,
      preserveTraceCount: 5,
    });

    expect(result.compressed).toBe(true);
    const flattened = result.messages.map((message) => JSON.stringify(message.content)).join('\n');
    expect(flattened).toContain('old-plan.md');
    expect(flattened).toContain('Error: file not found');
    expect(flattened).toContain('不要重复 read_file');
    expect(flattened).toContain('换一种方式');
  });

  it('detects repeated identical tool failure loops in a long session tail', () => {
    const detector = new LoopDetector();
    let result: ReturnType<LoopDetector['record']> = { type: 'ok' };

    for (let i = 0; i < 8; i++) {
      result = detector.record('read_file', { path: 'missing-spec.md' });
    }

    expect(result.type).toBe('warning');
    if (result.type !== 'warning') {
      throw new Error('expected warning');
    }
    expect(result.message).toContain('可能陷入循环');
    expect(result.message).toContain('read_file');
  });

  it('builds a runtime working summary instead of promoting temporary task state into long-term memory', () => {
    const summary = createWorkingSummaryMessage([
      textMessage('user', '请继续处理上次任务，如果旧计划不可用就换一种方式'),
      textMessage('assistant', '最近失败原因：old-plan.md 不存在，不要重复 read_file，改为请求用户补充路径'),
    ]);

    expect(summary).not.toBeNull();
    const text = JSON.stringify(summary?.content);
    expect(text).toContain('当前任务');
    expect(text).toContain('最近失败原因');
    expect(text).toContain('禁止重复动作');
    expect(text).toContain('换一种方式');
  });

  it('keeps collaboration correction messages visible after supervisor-style trace compression', () => {
    const messages: AgentMessage[] = [];

    for (let i = 0; i < 16; i++) {
      messages.push(textMessage('assistant', `worker-progress-${i}`));
    }

    messages.push(textMessage('assistant', 'Supervisor: 当前工具链没有进展，停止重复读取同一文件'));
    messages.push({
      role: 'assistant',
      content: [{ type: 'toolCall', id: 'call-2', name: 'dispatch_worker', arguments: { workerId: 'doc-agent', task: 'request missing file path from user' } }],
    } as AgentMessage);
    messages.push({
      role: 'toolResult',
      content: [{ type: 'text', text: 'worker acknowledged correction' }],
      toolName: 'dispatch_worker',
      toolCallId: 'call-2',
    } as AgentMessage);
    messages.push(textMessage('assistant', 'Supervisor correction: 改为向用户确认缺失路径，不再沿用旧计划'));

    const result = compressRecentTrace(messages, {
      maxHistory: 12,
      keepRecent: 6,
      preserveTraceCount: 4,
    });

    expect(result.compressed).toBe(true);
    const flattened = result.messages.map((message) => JSON.stringify(message.content)).join('\n');
    expect(flattened).toContain('没有进展');
    expect(flattened).toContain('dispatch_worker');
    expect(flattened).toContain('request missing file path from user');
    expect(flattened).toContain('不再沿用旧计划');
  });
});
