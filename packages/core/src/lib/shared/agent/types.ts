/**
 * shared/agent/types.ts — Layer 0 Agent 解析接口
 *
 * 仅接口定义，无运行时实现。
 * 允许 modules/ 通过依赖注入获取 Agent 解析能力，而不直接 import lib/integrations/。
 */

export interface AgentDefinition {
  name: string;
  description?: string;
  role?: string;
  capabilities?: string[];
  [key: string]: unknown;
}

export interface ToolDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AgentDefinitionParser {
  parseAgentDefinition(content: string): AgentDefinition;
  parseToolDefinition(content: string): ToolDefinition;
}
