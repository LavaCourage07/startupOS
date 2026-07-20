/**
 * 健康检查模块
 * 实现 Agent 健康状态检查和指标收集
 */

import type { OriginOSAgent } from "./core/agent";
import { AgentStatus } from "../../../types/agent";

// Re-export for backward compatibility
export { AgentStatus };

/**
 * 健康状态
 */
export type HealthStatus = "healthy" | "unhealthy" | "initializing";

/**
 * Agent 健康状态
 */
export interface AgentHealthStatus {
	/**
	 * 当前健康状态
	 */
	status: HealthStatus;

	/**
	 * 运行时长（秒）
	 */
	uptime: number;

	/**
	 * 内存使用量（MB）
	 */
	memoryUsage: number;

	/**
	 * 已处理的消息数量
	 */
	messagesProcessed: number;

	/**
	 * 最后心跳时间
	 */
	lastHeartbeat: Date;

	/**
	 * Agent ID
	 */
	agentId?: string;

	/**
	 * 会话 ID
	 */
	sessionId?: string;

	/**
	 * 是否正在处理请求
	 */
	isProcessing?: boolean;

	/**
	 * 错误信息（如果不健康）
	 */
	error?: string;
}

// ============================================================================
// Health Monitor Class
// ============================================================================

/**
 * 健康监控器
 */
export class HealthMonitor {
	// 代理状态
	private status: AgentStatus = AgentStatus.IDLE;

	// 启动时间
	private startTime: number | null = null;

	// 消息计数器
	private messagesProcessed = 0;

	// 最后心跳时间
	private lastHeartbeat = new Date();

	// 错误信息
	private lastError: string | null = null;

	// 是否正在处理
	private isProcessing = false;

	// Agent 引用
	private agent: OriginOSAgent | null = null;

	/**
	 * 设置 Agent 引用
	 */
	setAgent(agent: OriginOSAgent): void {
		this.agent = agent;
	}

	/**
	 * 获取当前状态
	 */
	getStatus(): AgentStatus {
		return this.status;
	}

	/**
	 * 设置状态
	 */
	setStatus(status: AgentStatus): void {
		this.status = status;
		this.lastHeartbeat = new Date();

		if (status === AgentStatus.ERROR) {
			this.lastError = "Agent entered error state";
		} else {
			this.lastError = null;
		}
	}

	/**
	 * 标记 Agent 为运行中
 */
	markAsRunning(): void {
		this.status = AgentStatus.RUNNING;
		this.startTime = Date.now();
		this.lastHeartbeat = new Date();
		this.lastError = null;
	}

	/**
	 * 标记 Agent 为已停止
	 */
	markAsStopped(): void {
		this.status = AgentStatus.IDLE;
		this.startTime = null;
		this.isProcessing = false;
		this.lastHeartbeat = new Date();
	}

	/**
	 * 记录消息处理
	 */
	recordMessageHandled(): void {
		this.messagesProcessed++;
		this.lastHeartbeat = new Date();
	}

	/**
	 * 标记处理开始
	 */
	markProcessingStart(): void {
		this.isProcessing = true;
	}

	/**
	 * 标记处理结束
	 */
	markProcessingEnd(): void {
		this.isProcessing = false;
	}

	/**
	 * 记录错误
	 */
	recordError(error: string): void {
		this.status = AgentStatus.ERROR;
		this.lastError = error;
		this.lastHeartbeat = new Date();
	}

	/**
	 * 获取运行时长（秒）
	 */
	private calculateUptime(): number {
		if (!this.startTime) {
			return 0;
		}
		return Math.floor((Date.now() - this.startTime) / 1000);
	}

	/**
	 * 获取内存使用量（MB）
	 */
	private getMemoryUsage(): number {
		if (typeof performance !== "undefined" && (performance as any).memory) {
			return (performance as any).memory.usedJSHeapSize / 1024 / 1024;
		}
		// 如果 performance.memory 不可用，返回估算值
		return process.memoryUsage ? process.memoryUsage().heapUsed / 1024 / 1024 : 0;
	}

	/**
	 * 获取健康状态
	 */
	getHealthStatus(): AgentHealthStatus {
		let healthStatus: HealthStatus;

		switch (this.status) {
			case AgentStatus.RUNNING:
				healthStatus = "healthy";
				break;
			case AgentStatus.INITIALIZING:
				healthStatus = "initializing";
				break;
			case AgentStatus.IDLE:
			case AgentStatus.ERROR:
			default:
				healthStatus = "unhealthy";
				break;
		}

		// 检查心跳超时（30秒无响应则不健康）
		const heartbeatAge = Date.now() - this.lastHeartbeat.getTime();
		if (healthStatus === "healthy" && heartbeatAge > 30000) {
			healthStatus = "unhealthy";
			this.lastError = "Heartbeat timeout";
		}

		return {
			status: healthStatus,
			uptime: this.calculateUptime(),
			memoryUsage: this.getMemoryUsage(),
			messagesProcessed: this.messagesProcessed,
			lastHeartbeat: this.lastHeartbeat,
			agentId: this.agent?.state.sessionId,
			sessionId: this.agent?.state.sessionId,
			isProcessing: this.isProcessing,
			error: this.lastError ?? undefined,
		};
	}

	/**
	 * 重置监控
	 */
	reset(): void {
		this.status = AgentStatus.IDLE;
		this.startTime = null;
		this.messagesProcessed = 0;
		this.lastHeartbeat = new Date();
		this.lastError = null;
		this.isProcessing = false;
	}
}

// ============================================================================
// Standalone Functions
// ============================================================================

/**
 * 创建新的健康监控器
 */
export function createHealthMonitor(): HealthMonitor {
	return new HealthMonitor();
}

// 默认健康监控器实例
const defaultHealthMonitor = new HealthMonitor();

/**
 * 获取默认健康监控器
 */
export function getDefaultHealthMonitor(): HealthMonitor {
	return defaultHealthMonitor;
}

/**
 * 执行健康检查（使用默认监控器）
 */
export function healthCheck(
	agent?: OriginOSAgent
): AgentHealthStatus {
	if (agent) {
		defaultHealthMonitor.setAgent(agent);
	}
	return defaultHealthMonitor.getHealthStatus();
}

/**
 * 执行健康检查（使用指定监控器）
 */
export function checkHealth(monitor: HealthMonitor): AgentHealthStatus {
	return monitor.getHealthStatus();
}
