/**
 * 访谈完成处理模块（使用真实 API）
 */

import type { InterviewResult } from "../../../types/interview";
import type { Project, CreateProjectRequest } from "../../../types/project";
import type { OntologyModel, OntologyNode } from "../../../types/interview";
import { createProject } from "../../integrations/electron/services/project";
import { generateOntology } from "../../integrations/electron/services/ontology";

// ============================================================================
// Types
// ============================================================================

export interface InterviewCompletionOptions {
  autoCreateProject?: boolean;
  autoSaveOntology?: boolean;
  projectDescriptionTemplate?: (data: InterviewResult) => string;
  projectTypeMapping?: Record<string, string>;
}

export interface InterviewCompletionResult {
  project: Project | null;
  ontologyId?: string;
  error?: string;
}

// ============================================================================
// Interview Completion Handler
// ============================================================================

export class InterviewCompletionHandler {
  private static instance: InterviewCompletionHandler;

  private constructor() {}

  static getInstance(): InterviewCompletionHandler {
    if (!InterviewCompletionHandler.instance) {
      InterviewCompletionHandler.instance = new InterviewCompletionHandler();
    }
    return InterviewCompletionHandler.instance;
  }

  private defaultDescriptionTemplate(data: InterviewResult): string {
    const domain = data.domain;
    const mode = data.mode;
    const tasks = data.tasks;

    return `基于 ${domain} 领域创建的项目，${mode} 模式。主要任务：${tasks}`;
  }

  private defaultProjectTypeMapping: Record<string, string> = {
    软件开发: "software",
    产品设计: "design",
    数据分析: "analytics",
    市场营销: "marketing",
    教育培训: "education",
    投资分析: "investment",
    项目管理: "management",
    "其他": "generic",
  };

  private generateProjectData(
    data: InterviewResult,
    options: InterviewCompletionOptions = {}
  ): CreateProjectRequest {
    const template = options.projectDescriptionTemplate || this.defaultDescriptionTemplate;
    const typeMapping = options.projectTypeMapping || this.defaultProjectTypeMapping;

    let projectType = "generic";
    for (const [key, type] of Object.entries(typeMapping)) {
      if (data.domain.includes(key)) {
        projectType = type;
        break;
      }
    }

    const projectName =
      data.projectName && data.projectName.trim()
        ? data.projectName
        : `${data.domain} 项目`;

    return {
      name: projectName,
      description: template(data),
      domain: data.domain,
      type: projectType,
      userId: "current-user",
    };
  }

  private generateOntologyModel(data: InterviewResult): OntologyModel {
    if (data.ontology) {
      return data.ontology;
    }

    const now = Date.now();
    const ontologyId = `ontology-${now}`;

    const concepts: OntologyNode[] = [
      {
        id: `domain-${now}`,
        name: "领域",
        type: "entity",
        description: data.domain || "未知领域",
        children: [
          {
            id: `mode-${now}`,
            name: "工作模式",
            type: "class",
            description: data.mode || "未知模式",
          },
        ],
      },
      {
        id: `tasks-${now}`,
        name: "任务",
        type: "entity",
        description: "主要工作任务",
        children: this.extractTaskConcepts(data.tasks),
      },
    ];

    if (data.concepts && data.concepts.length > 0) {
      concepts.push(
        ...data.concepts.map((concept: any) => ({
          id: `concept-${concept.name || Math.random().toString(36)}`,
          name: concept.name || "未命名概念",
          type: concept.type || "class",
          description: concept.description || "",
        }))
      );
    }

    return {
      id: ontologyId,
      name: data.projectName || `${data.domain} 本体`,
      description: `基于访谈 "${data.domain}" 生成的初始本体`,
      nodes: concepts,
      createdAt: now,
    };
  }

  private extractTaskConcepts(tasks: string): OntologyNode[] {
    if (!tasks || tasks.trim().length === 0) {
      return [
        {
          id: `task-default-${Date.now()}`,
          name: "默认任务",
          type: "class",
          description: "待定义的任务",
        },
      ];
    }

    const taskList = tasks
      .split(/[,，、；;]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (taskList.length === 0) {
      return [
        {
          id: `task-default-${Date.now()}`,
          name: tasks || "任务",
          type: "class",
          description: "主要任务",
        },
      ];
    }

    return taskList.map((task, index) => ({
      id: `task-${Date.now()}-${index}`,
      name: task.length > 20 ? task.substring(0, 20) + "..." : task,
      type: "class",
      description: task,
    }));
  }

  /**
   * Save ontology using API
   */
  private async saveOntology(ontologyModel: OntologyModel): Promise<string> {
    const result = await generateOntology({
      projectId: ontologyModel.id,
      answers: {
        work_domain: ontologyModel.name,
      },
    });

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to save ontology');
    }

    const data = result.data as { ontology?: { id: string } } | undefined;
    if (data?.ontology?.id) {
      return data.ontology.id;
    }

    return ontologyModel.id;
  }

  /**
   * Create project using API
   */
  private async createProject(createRequest: CreateProjectRequest): Promise<Project> {
    const result = await createProject(createRequest);
    if (result.success) {
      return result.data as Project;
    }
    throw new Error(result.error?.message || 'Failed to create project');
  }

  async handleInterviewCompletion(
    data: InterviewResult,
    options: InterviewCompletionOptions = {}
  ): Promise<InterviewCompletionResult> {
    try {
      console.log("开始处理访谈完成");

      const projectData = this.generateProjectData(data, options);
      const ontologyModel = this.generateOntologyModel(data);

      let ontologyId: string | undefined;
      if (options.autoSaveOntology !== false) {
        ontologyId = await this.saveOntology(ontologyModel);
      }

      let project: Project | null = null;
      if (options.autoCreateProject !== false) {
        const createRequest: CreateProjectRequest = {
          ...projectData,
          ontologyId,
        };
        project = await this.createProject(createRequest);
      }

      return {
        project,
        ontologyId,
        error: undefined,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "处理访谈完成时出错";
      console.error("处理访谈完成失败:", error);

      return {
        project: null,
        ontologyId: undefined,
        error: errorMessage,
      };
    }
  }

  validateInterviewResult(data: InterviewResult): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!data.projectName || data.projectName.trim().length === 0) {
      errors.push("项目名称不能为空");
    }

    if (!data.domain || data.domain.trim().length === 0) {
      errors.push("工作领域不能为空");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const interviewCompletionHandler = InterviewCompletionHandler.getInstance();
