/**
 * 系统内置应用配置
 *
 * 这些应用由系统预装，不属于用户安装的技能或 Agent。
 * 工作目录（CWD）和输出目录（outputDir）已分离：
 * - workingDirectory: bash 执行和认知文件写入
 * - outputDir: Agent / Skill runtime 持有的产物输出目录
 */

export interface SystemAppConfig {
  code: string;
  name: string;
}

export const SYSTEM_APPS: SystemAppConfig[] = [
  { code: 'role-agent-creator', name: '角色 Agent 创建助手' },
  { code: 'skill-creator-app', name: 'Skill 技能创建助手' },
  { code: 'agent-creator', name: 'Agent 创建助手' },
  { code: 'search-and-install-skill', name: '搜索并安装市场技能' },
  { code: 'bmad-brainstorming', name: '头脑风暴' },
  { code: 'sandbox', name: '代码沙箱' },
  { code: 'bmad-workflow-builder', name: '工作流构建' },
];

export function isSystemApp(code: string): boolean {
  return SYSTEM_APPS.some(a => a.code === code);
}

export function getSystemApp(code: string): SystemAppConfig | undefined {
  return SYSTEM_APPS.find(a => a.code === code);
}
