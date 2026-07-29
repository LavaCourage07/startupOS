/**
 * Session Store
 * 会话持久化管理 - 保存和恢复 Agent 会话状态
 */

import type { AgentMessage } from "@originos/pi-agent-adapter";
import type { ProjectContext } from "./types";
import type { SessionData } from "./core/agent";
import { jsonStore } from "../../../lib/storage";
import fs from "fs/promises";

// ============================================================================
// 会话数据类型
// ============================================================================

/**
 * 会话列表数据（存储在 sessions.json）
 */
export interface SessionsListData {
	currentSessionId: string | null;
	sessions: StoredSession[];
}

/**
 * 存储的会话数据（可序列化的版本）
 */
export interface StoredSession {
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
	messages: AgentMessage[];
	systemPrompt: string;
	model: {
		provider: string;
		id: string;
	};
	projectContext?: ProjectContext;
}

// ============================================================================
// Session Store
// ============================================================================

/**
 * 会话存储类
 * 负责会话的持久化、恢复和管理
 */
export class SessionStore {
	private static readonly SESSIONS_FILE = "data/sessions/sessions.json";
	private sessionsCache: SessionsListData | null = null;

	/**
	 * 初始化存储
	 */
	async initialize(): Promise<void> {
		// 确保目录存在
		await fs.mkdir("data/sessions", { recursive: true });

		// 加载现有会话
		await this.loadSessions();
	}

	/**
	 * 保存会话
	 */
	async saveSession(sessionData: StoredSession): Promise<void> {
		await this.loadSessions();

		const existingIndex = this.sessionsCache!.sessions.findIndex(
			(s) => s.id === sessionData.id
		);

		if (existingIndex >= 0) {
			// 更新现有会话
			this.sessionsCache!.sessions[existingIndex] = {
				...sessionData,
				updatedAt: Date.now(),
			};
		} else {
			// 添加新会话
			this.sessionsCache!.sessions.push({
				...sessionData,
				name: sessionData.name || SessionStore.generateDefaultName(sessionData.id),
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
		}

		// 设置为当前会话
		this.sessionsCache!.currentSessionId = sessionData.id;

		// 保存到文件
		await jsonStore.write(SessionStore.SESSIONS_FILE, this.sessionsCache!);
	}

	/**
	 * 加载会话
	 */
	async loadSession(sessionId: string): Promise<StoredSession | null> {
		await this.loadSessions();

		return (
			this.sessionsCache!.sessions.find((s) => s.id === sessionId) ?? null
		);
	}

	/**
	 * 加载当前会话
	 */
	async loadCurrentSession(): Promise<StoredSession | null> {
		await this.loadSessions();

		if (!this.sessionsCache!.currentSessionId) {
			return null;
		}

		return await this.loadSession(this.sessionsCache!.currentSessionId);
	}

	/**
	 * 列出所有会话
	 */
	async listSessions(): Promise<StoredSession[]> {
		await this.loadSessions();

		// 按更新时间倒序排列
		return [...this.sessionsCache!.sessions].sort(
			(a, b) => b.updatedAt - a.updatedAt
		);
	}

	/**
	 * 删除会话
	 */
	async deleteSession(sessionId: string): Promise<boolean> {
		await this.loadSessions();

		const index = this.sessionsCache!.sessions.findIndex(
			(s) => s.id === sessionId
		);

		if (index < 0) {
			return false;
		}

		this.sessionsCache!.sessions.splice(index, 1);

		// 如果删除的是当前会话，清空 currentSessionId
		if (this.sessionsCache!.currentSessionId === sessionId) {
			this.sessionsCache!.currentSessionId = null;
		}

		await jsonStore.write(SessionStore.SESSIONS_FILE, this.sessionsCache!);
		return true;
	}

	/**
	 * 重命名会话
	 */
	async renameSession(sessionId: string, newName: string): Promise<boolean> {
		await this.loadSessions();

		const session = this.sessionsCache!.sessions.find(
			(s) => s.id === sessionId
		);

		if (!session) {
			return false;
		}

		session.name = newName;
		session.updatedAt = Date.now();

		await jsonStore.write(SessionStore.SESSIONS_FILE, this.sessionsCache!);
		return true;
	}

	/**
	 * 设置当前会话
	 */
	async setCurrentSession(sessionId: string): Promise<boolean> {
		await this.loadSessions();

		const session = this.sessionsCache!.sessions.find(
			(s) => s.id === sessionId
		);

		if (!session) {
			return false;
		}

		this.sessionsCache!.currentSessionId = sessionId;
		await jsonStore.write(SessionStore.SESSIONS_FILE, this.sessionsCache!);
		return true;
	}

	/**
	 * 创建新会话
	 */
	async createSession(name?: string): Promise<StoredSession> {
		const session: StoredSession = {
			id: this.generateSessionId(),
			name: name || "新会话",
			createdAt: Date.now(),
			updatedAt: Date.now(),
			messages: [],
			systemPrompt: "",
			model: {
				provider: "anthropic",
				id: "claude-haiku-4-5",
			},
		};

		await this.saveSession(session);
		return session;
	}

	/**
	 * 清空所有会话
	 */
	async clearAllSessions(): Promise<void> {
		this.sessionsCache = {
			currentSessionId: null,
			sessions: [],
		};

		await jsonStore.write(SessionStore.SESSIONS_FILE, this.sessionsCache);
	}

	/**
	 * 获取当前会话 ID
	 */
	getCurrentSessionId(): string | null {
		return this.sessionsCache?.currentSessionId ?? null;
	}

	/**
	 * 从 Agent 状态创建会话数据
	 */
	static fromAgentSession(
		sessionId: string,
		messages: AgentMessage[],
		systemPrompt: string,
		model: { provider: string; id: string },
		projectContext?: ProjectContext
	): StoredSession {
		return {
			id: sessionId,
			name: SessionStore.generateDefaultName(sessionId),
			createdAt: Date.now(),
			updatedAt: Date.now(),
			messages,
			systemPrompt,
			model,
			projectContext,
		};
	}

	/**
	 * 将存储的会话数据转换为 Agent 恢复数据
	 */
	static toAgentSession(session: StoredSession): Partial<SessionData> {
		return {
			sessionId: session.id,
			messages: session.messages,
			systemPrompt: session.systemPrompt,
			model: session.model,
			createdAt: session.createdAt,
			updatedAt: session.updatedAt,
			projectContext: session.projectContext,
		};
	}

	/**
	 * 从会话数据生成 SessionData
	 */
	static toSessionData(session: StoredSession): SessionData {
		return {
			sessionId: session.id,
			messages: session.messages,
			systemPrompt: session.systemPrompt,
			model: session.model,
			createdAt: session.createdAt,
			updatedAt: session.updatedAt,
			projectContext: session.projectContext,
		};
	}

	// ============================================================================
	// 私有方法
	// ============================================================================

	/**
	 * 加载会话列表到缓存
	 */
	private async loadSessions(): Promise<void> {
		if (this.sessionsCache) {
			return; // 已加载
		}

		const existing = await jsonStore.read<SessionsListData>(
			SessionStore.SESSIONS_FILE
		);

		if (existing) {
			this.sessionsCache = existing.data;
		} else {
			this.sessionsCache = {
				currentSessionId: null,
				sessions: [],
			};
		}
	}

	/**
	 * 生成会话 ID
	 */
	private generateSessionId(): string {
		return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
	}

	/**
	 * 生成默认会话名称
	 */
	static generateDefaultName(_sessionId: string): string {
		const date = new Date();
		const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;
		const timeStr = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
		return `对话 ${dateStr} ${timeStr}`;
	}

	/**
	 * 从消息生成会话名称（基于第一条用户消息）
	 */
	static generateNameFromMessage(messages: AgentMessage[]): string {
		const firstUserMessage = messages.find((m) => m.role === "user");
		if (!firstUserMessage) {
			return "新会话";
		}

		// 如果内容是数组类型（复杂内容），从中提取文本
		const content = typeof firstUserMessage.content === "string"
			? firstUserMessage.content
			: SessionStore.extractTextFromContent(firstUserMessage.content);

		// 截取前 20 个字符 (超过 20 才加 "...")
		if (content.length > 20) {
			return content.substring(0, 20) + "...";
		}
		return content;
	}

	/**
	 * 从复杂内容中提取文本
	 */
	private static extractTextFromContent(content: unknown): string {
		if (typeof content === "string") {
			return content;
		}

		// 处理数组类型的内容
		if (Array.isArray(content)) {
			// 先检查是否有字符串元素
			const textPart = content.find((c) => typeof c === "string");
			if (textPart) return textPart as string;

			// 处理对象类型的内容 (例如 [{ type: "text", text: "测试" }])
			for (const c of content) {
				if (c && typeof c === "object") {
					const typed = c as Record<string, unknown>;
					if ("text" in typed && typeof typed['text'] === "string") {
						return typed['text'];
					}
				}
			}

			// 如果没有找到，返回空字符串
			return "";
		}

		// 处理对象类型的内容
		if (content && typeof content === "object" && "text" in content) {
			const text = (content as { text: string }).text;
			if (typeof text === "string") {
				return text;
			}
		}

		// 其他情况，返回 JSON 字符串的一部分
		return JSON.stringify(content).substring(0, 50);
	}
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const sessionStore = new SessionStore();
