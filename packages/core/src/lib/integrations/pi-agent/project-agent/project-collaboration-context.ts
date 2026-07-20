/**
 * 多 Agent 协作上下文加载器
 *
 * 在项目 Agent 启动时加载协作场景所需的所有 .md 文件
 * （Agent.md + Data.md + Process.md + Tool.md + Taste.md + Memory.md）
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';

import { scanInstalledSkills, type SkillInfo } from '../role-agent/skill-resolver';

export { type SkillInfo };

/** 多 Agent 协作上下文 */
export interface ProjectCollaborationContext {
  /** Agent.md 全文（身份、职责、工作边界） */
  agentMd: string;
  /** Data.md 全文（数据契约：本体对象、字段、约束、操作权限） */
  dataMd: string;
  /** Process.md 全文（处理流程、异常处理、协作协议） */
  processMd: string;
  /** Tool.md 全文（工具配置） */
  toolMd: string | null;
  /** Taste.md 全文（风格指南） */
  tasteMd: string | null;
  /** Memory.md 全文（历史记忆） */
  memoryMd: string | null;
  /** Knowledge.md 全文（知识快照） */
  knowledgeMd: string | null;
  /** Patterns.md 全文（经验模式快照） */
  patternsMd: string | null;
  /** 已安装技能列表 */
  installedSkills: SkillInfo[];
  /** Tool.md frontmatter 中的 allowedTools */
  allowedTools: string[];
  /** 项目工作目录 */
  workingDirectory: string;
  /** 项目 ID */
  projectId: string;
  /** Agent ID */
  agentId: string;
  /** OriginOS 业务项目 ID（ proj-{id} ），用于区分业务项目和本体中的"项目"概念 */
  originosProjectId: string | null;
}

/** 安全读取 .md 文件 */
function readMdFile(dir: string, fileName: string): string | null {
  const filePath = path.join(dir, fileName);
  if (!existsSync(filePath)) { return null; }
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/** 从 Tool.md frontmatter 提取 allowedTools */
function parseAllowedTools(toolMd: string | null): string[] {
  if (toolMd === null) { return []; }
  const match = toolMd.match(/^---\n([\s\S]*?)\n---/);
  if (match === null || match[1] === undefined) { return []; }
  const frontmatter = match[1];
  const keyMatch = frontmatter.match(/^allowedTools:\s*\[([^\]]*)\]/m);
  if (keyMatch === null || keyMatch[1] === undefined) { return []; }
  return keyMatch[1]
    .split(',')
    .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

/**
 * 加载多 Agent 协作上下文
 * @param projectDir 项目工作目录
 * @param projectId 项目 ID
 * @param agentId Agent ID
 * @returns ProjectCollaborationContext，若 Agent.md 不存在则返回 null
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function loadProjectCollaborationContext(
  projectDir: string,
  projectId: string,
  agentId: string,
): Promise<ProjectCollaborationContext | null> {
  const agentMd = readMdFile(projectDir, 'Agent.md');
  if (agentMd === null) { return null; }

  const dataMd = readMdFile(projectDir, 'Data.md') ?? '';
  const processMd = readMdFile(projectDir, 'Process.md') ?? '';
  const toolMd = readMdFile(projectDir, 'Tool.md');
  const tasteMd = readMdFile(projectDir, 'Taste.md');
  const memoryMd = readMdFile(projectDir, 'Memory.md');
  const knowledgeMd = readMdFile(projectDir, 'Knowledge.md');
  const patternsMd = readMdFile(projectDir, 'Patterns.md');

  const allowedTools = parseAllowedTools(toolMd);
  const installedSkills = scanInstalledSkills(projectDir);

  // 尝试从 project-collaboration-context.json 读取 originosProjectId
  let originosProjectId: string | null = null;
  const contextJsonPath = path.join(projectDir, 'project-collaboration-context.json');
  if (existsSync(contextJsonPath)) {
    try {
      const contextJson = JSON.parse(readFileSync(contextJsonPath, 'utf-8'));
      originosProjectId = contextJson.originosProjectId ?? null;
    } catch {
      // 忽略解析错误
    }
  }

  return {
    agentMd,
    dataMd,
    processMd,
    toolMd,
    tasteMd,
    memoryMd,
    knowledgeMd,
    patternsMd,
    installedSkills,
    allowedTools,
    workingDirectory: projectDir,
    projectId,
    agentId,
    originosProjectId,
  };
}
