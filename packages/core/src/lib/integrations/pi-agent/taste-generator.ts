/**
 * Taste.md 自动生成器
 *
 * 每 500 轮对话自动生成 Taste.md，记录用户偏好和风格
 * - 每 500 轮对话触发一次生成
 * - 保留最近 5 个版本（Taste.md, Taste.1.md, ..., Taste.4.md）
 * - 生成失败时重试 3 次
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import path from 'path';
import type { AgentMessage } from '@/types/agent';

export interface TasteEntry {
  timestamp: string;
  version: number;
  conversationCount: number;
  preferences: {
    communicationStyle: string[];
    technicalPreferences: string[];
    workflowPatterns: string[];
  };
  insights: string[];
}

/**
 * 从会话消息生成 Taste 偏好分析
 */
export async function generateTasteAnalysis(
  messages: AgentMessage[],
  conversationCount: number,
  model: 'haiku' | 'sonnet' = 'haiku'
): Promise<TasteEntry> {
  // 过滤出用户和助手消息
  const conversationMessages = messages.filter(
    m => m.role === 'user' || m.role === 'assistant'
  );

  if (conversationMessages.length === 0) {
    throw new Error('No conversation messages to analyze');
  }

  // 构建对话文本
  const conversationText = conversationMessages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  // 使用 LLM 生成偏好分析（这里简化处理，实际应调用 Anthropic API）
  // TODO: 集成 Anthropic API 调用
  const preferences = {
    communicationStyle: ['简洁直接', '技术导向'],
    technicalPreferences: ['TypeScript', 'React', 'Next.js'],
    workflowPatterns: ['测试驱动开发', '代码审查'],
  };
  const insights = ['用户偏好使用现代前端技术栈', '注重代码质量和测试覆盖'];

  return {
    timestamp: new Date().toISOString(),
    version: Math.floor(conversationCount / 500),
    conversationCount,
    preferences,
    insights,
  };
}

/**
 * 读取现有 Taste.md
 */
function readTasteFile(tastePath: string): TasteEntry | null {
  if (!existsSync(tastePath)) {
    return null;
  }

  try {
    const content = readFileSync(tastePath, 'utf-8');

    // 解析 Taste.md 格式
    const versionMatch = content.match(/## 版本 (\d+)/);
    const conversationMatch = content.match(/- \*\*对话轮数\*\*: (\d+)/);
    const timestampMatch = content.match(/- \*\*生成时间\*\*: (.*)/);

    if (!versionMatch || !conversationMatch || !timestampMatch) {
      return null;
    }

    // 简化解析，实际应该完整解析所有字段
    return {
      timestamp: timestampMatch[1],
      version: parseInt(versionMatch[1], 10),
      conversationCount: parseInt(conversationMatch[1], 10),
      preferences: {
        communicationStyle: [],
        technicalPreferences: [],
        workflowPatterns: [],
      },
      insights: [],
    };
  } catch (error) {
    console.error('Failed to read Taste.md:', error);
    return null;
  }
}

/**
 * 写入 Taste.md
 */
function writeTasteFile(tastePath: string, entry: TasteEntry): void {
  const lines = ['# Taste', '', `## 版本 ${entry.version}`, ''];

  lines.push(`- **生成时间**: ${new Date(entry.timestamp).toLocaleString('zh-CN')}`);
  lines.push(`- **对话轮数**: ${entry.conversationCount}`);
  lines.push('');

  lines.push('## 沟通风格偏好');
  for (const style of entry.preferences.communicationStyle) {
    lines.push(`- ${style}`);
  }
  lines.push('');

  lines.push('## 技术偏好');
  for (const tech of entry.preferences.technicalPreferences) {
    lines.push(`- ${tech}`);
  }
  lines.push('');

  lines.push('## 工作流模式');
  for (const pattern of entry.preferences.workflowPatterns) {
    lines.push(`- ${pattern}`);
  }
  lines.push('');

  lines.push('## 关键洞察');
  for (const insight of entry.insights) {
    lines.push(`- ${insight}`);
  }
  lines.push('');

  mkdirSync(path.dirname(tastePath), { recursive: true });
  writeFileSync(tastePath, lines.join('\n'), 'utf-8');
}

/**
 * 轮转 Taste 文件版本
 * Taste.md -> Taste.1.md -> Taste.2.md -> ... -> Taste.4.md
 * 保留最近 5 个版本
 */
function rotateTasteVersions(baseDir: string): void {
  const tastePath = path.join(baseDir, 'Taste.md');

  // 如果 Taste.md 不存在，无需轮转
  if (!existsSync(tastePath)) {
    return;
  }

  // 删除最旧的版本 (Taste.4.md)
  const oldestPath = path.join(baseDir, 'Taste.4.md');
  if (existsSync(oldestPath)) {
    unlinkSync(oldestPath);
  }

  // 轮转版本: Taste.3.md -> Taste.4.md, Taste.2.md -> Taste.3.md, ...
  for (let i = 3; i >= 1; i--) {
    const currentPath = path.join(baseDir, `Taste.${i}.md`);
    const nextPath = path.join(baseDir, `Taste.${i + 1}.md`);
    if (existsSync(currentPath)) {
      renameSync(currentPath, nextPath);
    }
  }

  // Taste.md -> Taste.1.md
  const newPath = path.join(baseDir, 'Taste.1.md');
  renameSync(tastePath, newPath);
}

/**
 * 生成新的 Taste.md
 * 每 500 轮对话触发一次
 */
export async function generateTasteIfNeeded(
  baseDir: string,
  messages: AgentMessage[],
  maxRetries: number = 3
): Promise<boolean> {
  const tastePath = path.join(baseDir, 'Taste.md');

  // 计算对话轮数（用户消息数量）
  const conversationCount = messages.filter(m => m.role === 'user').length;

  // 检查是否达到 500 轮对话的倍数
  if (conversationCount === 0 || conversationCount % 500 !== 0) {
    return false;
  }

  console.log(`[TasteGenerator] Reached ${conversationCount} conversations, generating Taste.md`);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 生成 Taste 分析
      const newEntry = await generateTasteAnalysis(messages, conversationCount);

      // 轮转旧版本
      rotateTasteVersions(baseDir);

      // 写入新的 Taste.md
      writeTasteFile(tastePath, newEntry);

      console.log(`[TasteGenerator] Taste.md generated successfully (attempt ${attempt})`);
      return true;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[TasteGenerator] Failed to generate Taste.md (attempt ${attempt}/${maxRetries}):`, error);

      if (attempt < maxRetries) {
        // 等待 1 秒后重试
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  console.error('[TasteGenerator] Failed to generate Taste.md after all retries:', lastError);
  return false;
}

