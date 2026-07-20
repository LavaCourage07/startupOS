"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectContextWriter = void 0;
class ProjectContextWriter {
    constructor(blackboard, projectId) {
        this.blackboard = blackboard;
        this.projectId = projectId;
    }
    writeProjectContext(data) {
        const key = `agent-context:${data.agentId}`;
        this.blackboard.setData(key, data, data.agentId);
        const summaryKey = `project-context-summary:${this.projectId}`;
        const existing = this.blackboard.getData(summaryKey) ?? {};
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
exports.ProjectContextWriter = ProjectContextWriter;
