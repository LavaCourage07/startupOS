import type { Blackboard } from "../session/blackboard";

export interface ProjectContextData {
  agentId: string;
  agentMd: string;
  toolMd: string | null;
  tasteMd: string | null;
  memoryMd: string | null;
  knowledgeMd: string | null;
  patternsMd: string | null;
  installedSkills: string[];
  allowedTools: string[];
  workingDirectory: string;
  originosProjectId: string | null;
}

export interface ProjectContextSummary {
  agentId: string;
  workingDirectory: string;
  installedSkills: string[];
  allowedTools: string[];
  originosProjectId: string | null;
}

export class ProjectContextWriter {
  constructor(
    private readonly blackboard: Blackboard,
    private readonly projectId: string
  ) {}

  writeProjectContext(data: ProjectContextData): void {
    const key = `agent-context:${data.agentId}`;
    this.blackboard.setData(key, data, data.agentId);

    const summaryKey = `project-context-summary:${this.projectId}`;
    const existing = (this.blackboard.getData(summaryKey) as Record<string, ProjectContextSummary>) ?? {};
    existing[data.agentId] = {
      agentId: data.agentId,
      workingDirectory: data.workingDirectory,
      installedSkills: data.installedSkills,
      allowedTools: data.allowedTools,
      originosProjectId: data.originosProjectId,
    };
    this.blackboard.setData(summaryKey, existing, data.agentId);
  }
}
