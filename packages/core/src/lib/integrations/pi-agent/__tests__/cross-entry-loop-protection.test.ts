import { describe, expect, it } from 'vitest';
import type { AgentMessage } from '@mariozechner/agent';
import { createWorkingSummaryMessage } from '../runtime-working-summary';
import { compressRecentTrace } from '../recent-trace-compression';
import { buildAgentSystemPrompt } from '@/lib/features/services/launcher/base';
import { buildRuntimeWorkingSummary } from '../runtime-working-summary';

function textMessage(role: string, text: string): AgentMessage {
  return {
    role,
    content: [{ type: 'text', text }],
  } as AgentMessage;
}

describe('cross-entry loop protection', () => {
  it('assistant launcher prompt keeps long-term memory in prompt and runtime summary out of assistant history', () => {
    const systemPrompt = buildAgentSystemPrompt('你是一个助手。', {
      memory: '# Memory\n长期偏好：回答时先指出阻塞点',
      knowledge: '# Knowledge\n知识快照',
      patterns: '# Patterns\n经验快照',
      baseDir: '/tmp/agent',
    });

    expect(systemPrompt).toContain('Long-term Stable Memory');
    expect(systemPrompt).toContain('长期偏好');

    const runtimeSummary = createWorkingSummaryMessage([
      textMessage('user', '继续处理，如果旧路径不可用就换一种方式'),
      textMessage('assistant', '最近失败原因：missing.md 不存在'),
    ]);

    expect(runtimeSummary).not.toBeNull();
    expect(runtimeSummary?.role).toBe('system');
    expect(JSON.stringify(runtimeSummary?.content)).toContain('当前任务');
    expect(JSON.stringify(runtimeSummary?.content)).toContain('最近失败原因');
  });

  it('skill-style histories preserve user correction after compression', () => {
    const messages: AgentMessage[] = [];
    for (let i = 0; i < 12; i += 1) {
      messages.push(textMessage('assistant', `技能计划-${i}`));
    }

    messages.push(textMessage('user', '不要继续生成 Python 脚本，先检查 brainstorming 输出目录'));
    messages.push(textMessage('assistant', '收到，先检查输出目录'));
    messages.push({
      role: 'assistant',
      content: [{ type: 'toolCall', id: 'call-skill-1', name: 'execute_command', arguments: { command: 'ls brainstorming' } }],
    } as AgentMessage);
    messages.push({
      role: 'toolResult',
      content: [{ type: 'text', text: 'No such file or directory' }],
      toolName: 'execute_command',
      toolCallId: 'call-skill-1',
    } as AgentMessage);
    messages.push(textMessage('assistant', '最近失败原因：brainstorming 目录不存在，停止重复创建脚本'));

    const result = compressRecentTrace(messages, {
      maxHistory: 10,
      keepRecent: 6,
      preserveTraceCount: 4,
    });

    expect(result.compressed).toBe(true);
    const flattened = result.messages.map((message) => JSON.stringify(message.content)).join('\n');
    expect(flattened).toContain('不要继续生成 Python 脚本');
    expect(flattened).toContain('ls brainstorming');
    expect(flattened).toContain('目录不存在');
  });

  it('role-agent style histories summarize do-not-repeat guidance into runtime summary', () => {
    const summary = buildRuntimeWorkingSummary([
      textMessage('assistant', '你是项目经理。'),
      textMessage('user', '继续上次任务，旧计划不通就改路径'),
      textMessage('assistant', '最近失败原因：old-plan.md 不存在'),
      textMessage('assistant', '不要重复 read_file，改为询问缺失路径'),
    ]);

    expect(summary.currentTask).toContain('继续上次任务');
    expect(summary.failureReason).toContain('old-plan.md');
    expect(summary.doNotRepeat).toContain('不要重复 read_file');
  });

  it('multi-agent style traces preserve supervisor correction and user-facing redirect', () => {
    const messages: AgentMessage[] = [];
    for (let i = 0; i < 14; i += 1) {
      messages.push(textMessage('assistant', `worker-tail-${i}`));
    }

    messages.push(textMessage('assistant', 'Supervisor: 当前路径错误，停止重复读取同一文件'));
    messages.push(textMessage('user', '那就别再读旧文件了，先问我要正确路径'));
    messages.push({
      role: 'assistant',
      content: [{ type: 'toolCall', id: 'call-ma-1', name: 'dispatch_worker', arguments: { workerId: 'doc-agent', task: 'request file path from user' } }],
    } as AgentMessage);
    messages.push({
      role: 'toolResult',
      content: [{ type: 'text', text: 'worker acknowledged correction' }],
      toolName: 'dispatch_worker',
      toolCallId: 'call-ma-1',
    } as AgentMessage);
    messages.push(textMessage('assistant', 'Supervisor correction: 改为向用户确认路径'));

    const result = compressRecentTrace(messages, {
      maxHistory: 11,
      keepRecent: 7,
      preserveTraceCount: 4,
    });

    expect(result.compressed).toBe(true);
    const flattened = result.messages.map((message) => JSON.stringify(message.content)).join('\n');
    expect(flattened).toContain('停止重复读取同一文件');
    expect(flattened).toContain('先问我要正确路径');
    expect(flattened).toContain('request file path from user');
    expect(flattened).toContain('改为向用户确认路径');
  });
});
