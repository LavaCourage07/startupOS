/**
 * 工具执行上下文管理器
 * 提供工具执行时需要的上下文信息
 *
 * 设计原则：工具层不关心平台概念（Agent/Skill/Project），
 * workingDirectory 由上游（agent-manager）统一解析后传入。
 */

/**
 * 工具执行上下文
 */
export interface ToolExecutionContext {
	/**
	 * 会话ID
	 */
	sessionId?: string;

	/**
	 * 工具执行时的工作目录 — 唯一基准路径
	 * 由 agent-manager 在创建会话时根据 agentType/agentBaseDir 统一解析
	 */
	workingDirectory?: string;
}

/**
 * 上下文管理器类
 */
class ToolContextManager {
	private contexts = new Map<string, ToolExecutionContext>();
	private defaultContext: ToolExecutionContext = {};

	setContext(sessionId: string, context: ToolExecutionContext): void {
		this.contexts.set(sessionId, context);
	}

	getContext(sessionId?: string): ToolExecutionContext {
		if (!sessionId) {
			return this.defaultContext;
		}
		return this.contexts.get(sessionId) || this.defaultContext;
	}

	removeContext(sessionId: string): void {
		this.contexts.delete(sessionId);
	}

	clear(): void {
		this.contexts.clear();
	}

	setDefaultContext(context: ToolExecutionContext): void {
		this.defaultContext = context;
	}

}

const globalContextManager = new ToolContextManager();

export function getToolContextManager(): ToolContextManager {
	return globalContextManager;
}

export function setToolContext(sessionId: string, context: ToolExecutionContext): void {
	globalContextManager.setContext(sessionId, context);
}

export function getToolContext(sessionId?: string): ToolExecutionContext {
	return globalContextManager.getContext(sessionId);
}

export function removeToolContext(sessionId: string): void {
	globalContextManager.removeContext(sessionId);
}
