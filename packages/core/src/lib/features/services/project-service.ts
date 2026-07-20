/**
 * 项目服务
 *
 * 提供项目的 CRUD 操作和持久化
 */

import { jsonStore } from "../../storage";

// ============================================================================
// Types
// ============================================================================

import type {
	Project,
	CreateProjectRequest,
	UpdateProjectRequest,
	ProjectListItem,
	ProjectQuery,
} from "@/types/project";

import type { DataFile } from "../../storage/json-store";

// ============================================================================
// Project Service
// ============================================================================

/**
 * 项目服务类
 */
export class ProjectService {
	private static instance: ProjectService;

	private constructor() {}

	/**
	 * 获取单例实例
	 */
	static getInstance(): ProjectService {
		if (!ProjectService.instance) {
			ProjectService.instance = new ProjectService();
		}
		return ProjectService.instance;
	}

	/**
	 * 生成项目 ID
	 */
	private generateId(): string {
		return `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * 创建项目
	 */
	async createProject(request: CreateProjectRequest): Promise<Project> {
		const now = Date.now();
		const projectId = this.generateId();

		// 如果未提供 ontologyId，基于项目 ID 生成
		const ontologyId = request.ontologyId || `ontology-${projectId}`;

		// 默认颜色
		const colors = [
			"from-blue-500",
			"from-purple-500",
			"from-green-500",
			"from-yellow-500",
			"from-pink-500",
			"from-indigo-500",
			"from-red-500",
			"from-orange-500",
		];
		const defaultColor = colors[projectId.charCodeAt(projectId.length - 1) % colors.length];

		const project: Project = {
			id: projectId,
			name: request.name,
			description: request.description || "",
			domain: request.domain,
			type: request.type || "generic",
			ontologyId,
			createdAt: now,
			updatedAt: now,
			lastModified: now,
			userId: request.userId || "current-user",
			status: "active",
			color: request.color || defaultColor,
			icon: undefined,
			metadata: {},
		};

		// 保存项目
		const filePath = jsonStore.getProjectPath(projectId);
		await jsonStore.write(filePath, project);

		// 同时创建关联的文件目录
		const filesDir = `${jsonStore["PROJECTS_DIR"]}/${projectId}/files`;
		const fs = await import("fs/promises");
		await fs.mkdir(filesDir, { recursive: true }).catch(() => {
			// 目录可能已存在，忽略错误
		});

		return project;
	}

	/**
	 * 获取项目
	 */
	async getProject(projectId: string): Promise<Project | null> {
		try {
			const filePath = jsonStore.getProjectPath(projectId);
			const file = await jsonStore.read<Project>(filePath);

			if (!file) {
				return null;
			}

			return file.data;
		} catch {
			return null;
		}
	}

	/**
	 * 获取多个项目
	 */
	async getProjects(projectIds: string[]): Promise<Project[]> {
		const projects: Project[] = [];

		for (const id of projectIds) {
			const project = await this.getProject(id);
			if (project) {
				projects.push(project);
			}
		}

		return projects;
	}

	/**
	 * 更新项目
	 */
	async updateProject(projectId: string, updates: UpdateProjectRequest): Promise<Project | null> {
		const existingProject = await this.getProject(projectId);

		if (!existingProject) {
			return null;
		}

		const now = Date.now();

		const updatedProject: Project = {
			...existingProject,
			...updates,
			updatedAt: now,
			lastModified: now,
			metadata: {
				...existingProject.metadata,
				...updates.metadata,
			},
		};

		// 保存更新
		const filePath = jsonStore.getProjectPath(projectId);
		const file = await jsonStore.read<Project>(filePath);

		if (file) {
			await jsonStore.write(filePath, updatedProject);
		}

		return updatedProject;
	}

	/**
	 * 删除项目
	 */
	async deleteProject(projectId: string): Promise<boolean> {
		try {
			// 软删除：更新状态为 deleted
			await this.updateProject(projectId, { status: "deleted" });
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * 彻底删除项目（包括文件）
	 */
	async permanentDeleteProject(projectId: string): Promise<boolean> {
		try {
			const filePath = jsonStore.getProjectPath(projectId);
			await jsonStore.delete(filePath);

			// 删除关联的文件目录
			const fs = await import("fs/promises");
			const projectDir = `${jsonStore["PROJECTS_DIR"]}/${projectId}`;
			await fs.rm(projectDir, { recursive: true, force: true }).catch(() => {
				// 目录可能不存在，忽略错误
			});

			return true;
		} catch {
			return false;
		}
	}

	/**
	 * 查询项目列表
	 */
	async listProjects(query: ProjectQuery = {}): Promise<ProjectListItem[]> {
		const allFiles = await jsonStore.listFiles(jsonStore["PROJECTS_DIR"]);

		const projects: ProjectListItem[] = [];

		for (const file of allFiles) {
			const projectId = file.replace(".json", "");
			const project = await this.getProject(projectId);

			if (!project) {
				continue;
			}

			// 状态过滤
			if (query.status && project.status !== query.status) {
				continue;
			}

			// 用户过滤
			if (query.userId && project.userId !== query.userId) {
				continue;
			}

			// 领域过滤
			if (query.domain && project.domain !== query.domain) {
				continue;
			}

			// 搜索过滤
			if (query.search) {
				const searchLower = query.search.toLowerCase();
				const nameMatch = project.name.toLowerCase().includes(searchLower);
				const descMatch = project.description.toLowerCase().includes(searchLower);
				const domainMatch = project.domain.toLowerCase().includes(searchLower);

				if (!nameMatch && !descMatch && !domainMatch) {
					continue;
				}
			}

			// 计算本体大小（简化版）
			const ontologyId = project.ontologyId;
			let ontologySize = 0;
			if (ontologyId) {
				const ontologyPath = jsonStore.getOntologyPath(ontologyId);
				const ontologyFile = await jsonStore.read<any>(ontologyPath);
				if (ontologyFile?.data?.nodes) {
					ontologySize = ontologyFile.data.nodes.length;
				}
			}

			projects.push({
				id: project.id,
				name: project.name,
				description: project.description,
				domain: project.domain,
				createdAt: project.createdAt,
				lastModified: project.lastModified,
				ontologySize,
				ontologyId: project.ontologyId || '',
				color: project.color,
				status: project.status,
				hasSolution: false, // TODO: 检查是否有解决方案
			});
		}

		// 排序
		const sortBy = query.sortBy || "lastModified";
		const sortOrder = query.sortOrder || "desc";

		projects.sort((a, b) => {
			let comparison = 0;

			if (sortBy === "name") {
				comparison = a.name.localeCompare(b.name);
			} else {
				comparison = (a[sortBy] as number) - (b[sortBy] as number);
			}

			return sortOrder === "desc" ? -comparison : comparison;
		});

		// 分页
		const offset = query.offset || 0;
		const limit = query.limit || projects.length;

		return projects.slice(offset, offset + limit);
	}

	/**
	 * 获取所有项目
	 */
	async getAllProjects(): Promise<Project[]> {
		const allFiles = await jsonStore.listFiles(jsonStore["PROJECTS_DIR"]);
		const projects: Project[] = [];

		for (const file of allFiles) {
			const projectId = file.replace(".json", "");
			const project = await this.getProject(projectId);
			if (project && project.status !== "deleted") {
				projects.push(project);
			}
		}

		return projects;
	}

	/**
	 * 导出项目
	 */
	async exportProject(projectId: string): Promise<string> {
		const project = await this.getProject(projectId);

		if (!project) {
			throw new Error("项目不存在");
		}

		// 获取关联的本体数据
		let ontologyData: any = null;
		if (project.ontologyId) {
			const ontologyPath = jsonStore.getOntologyPath(project.ontologyId);
			const ontologyFile = await jsonStore.read<any>(ontologyPath);
			ontologyData = ontologyFile?.data;
		}

		// 构建导出数据
		const exportData = {
			project,
			ontology: ontologyData,
			exportedAt: new Date().toISOString(),
			version: "1.0.0",
		};

		return JSON.stringify(exportData, null, 2);
	}

	/**
	 * 导入项目
	 */
	async importProject(
		exportJson: string,
		options?: { overwrite?: boolean; newId?: boolean }
	): Promise<Project> {
		const importData = JSON.parse(exportJson);

		if (!importData.project) {
			throw new Error("无效的导出数据");
		}

		const projectData: CreateProjectRequest = {
			name: importData.project.name,
			description: importData.project.description,
			domain: importData.project.domain,
			type: importData.project.type,
			color: importData.project.color,
			userId: importData.project.userId || "current-user",
		};

		// 如果需要新 ID，不使用 ontologyId
		if (options?.newId) {
			projectData.ontologyId = undefined;
		}

		// 创建项目
		const project = await this.createProject(projectData);

		// 保存本体数据
		if (importData.ontology) {
			const ontologyPath = jsonStore.getOntologyPath(project.ontologyId);
			await jsonStore.write(ontologyPath, importData.ontology);
		}

		return project;
	}
}

/**
 * 导出单例实例
 */
export const projectService = ProjectService.getInstance();
