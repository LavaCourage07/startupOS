"use strict";
/**
 * 健康检查模块
 * 实现 Agent 健康状态检查和指标收集
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthMonitor = exports.AgentStatus = void 0;
exports.createHealthMonitor = createHealthMonitor;
exports.getDefaultHealthMonitor = getDefaultHealthMonitor;
exports.healthCheck = healthCheck;
exports.checkHealth = checkHealth;
const agent_1 = require("../../../types/agent");
Object.defineProperty(exports, "AgentStatus", { enumerable: true, get: function () { return agent_1.AgentStatus; } });
// ============================================================================
// Health Monitor Class
// ============================================================================
/**
 * 健康监控器
 */
class HealthMonitor {
    constructor() {
        // 代理状态
        this.status = agent_1.AgentStatus.IDLE;
        // 启动时间
        this.startTime = null;
        // 消息计数器
        this.messagesProcessed = 0;
        // 最后心跳时间
        this.lastHeartbeat = new Date();
        // 错误信息
        this.lastError = null;
        // 是否正在处理
        this.isProcessing = false;
        // Agent 引用
        this.agent = null;
    }
    /**
     * 设置 Agent 引用
     */
    setAgent(agent) {
        this.agent = agent;
    }
    /**
     * 获取当前状态
     */
    getStatus() {
        return this.status;
    }
    /**
     * 设置状态
     */
    setStatus(status) {
        this.status = status;
        this.lastHeartbeat = new Date();
        if (status === agent_1.AgentStatus.ERROR) {
            this.lastError = "Agent entered error state";
        }
        else {
            this.lastError = null;
        }
    }
    /**
     * 标记 Agent 为运行中
 */
    markAsRunning() {
        this.status = agent_1.AgentStatus.RUNNING;
        this.startTime = Date.now();
        this.lastHeartbeat = new Date();
        this.lastError = null;
    }
    /**
     * 标记 Agent 为已停止
     */
    markAsStopped() {
        this.status = agent_1.AgentStatus.IDLE;
        this.startTime = null;
        this.isProcessing = false;
        this.lastHeartbeat = new Date();
    }
    /**
     * 记录消息处理
     */
    recordMessageHandled() {
        this.messagesProcessed++;
        this.lastHeartbeat = new Date();
    }
    /**
     * 标记处理开始
     */
    markProcessingStart() {
        this.isProcessing = true;
    }
    /**
     * 标记处理结束
     */
    markProcessingEnd() {
        this.isProcessing = false;
    }
    /**
     * 记录错误
     */
    recordError(error) {
        this.status = agent_1.AgentStatus.ERROR;
        this.lastError = error;
        this.lastHeartbeat = new Date();
    }
    /**
     * 获取运行时长（秒）
     */
    calculateUptime() {
        if (!this.startTime) {
            return 0;
        }
        return Math.floor((Date.now() - this.startTime) / 1000);
    }
    /**
     * 获取内存使用量（MB）
     */
    getMemoryUsage() {
        if (typeof performance !== "undefined" && performance.memory) {
            return performance.memory.usedJSHeapSize / 1024 / 1024;
        }
        // 如果 performance.memory 不可用，返回估算值
        return process.memoryUsage ? process.memoryUsage().heapUsed / 1024 / 1024 : 0;
    }
    /**
     * 获取健康状态
     */
    getHealthStatus() {
        let healthStatus;
        switch (this.status) {
            case agent_1.AgentStatus.RUNNING:
                healthStatus = "healthy";
                break;
            case agent_1.AgentStatus.INITIALIZING:
                healthStatus = "initializing";
                break;
            case agent_1.AgentStatus.IDLE:
            case agent_1.AgentStatus.ERROR:
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
    reset() {
        this.status = agent_1.AgentStatus.IDLE;
        this.startTime = null;
        this.messagesProcessed = 0;
        this.lastHeartbeat = new Date();
        this.lastError = null;
        this.isProcessing = false;
    }
}
exports.HealthMonitor = HealthMonitor;
// ============================================================================
// Standalone Functions
// ============================================================================
/**
 * 创建新的健康监控器
 */
function createHealthMonitor() {
    return new HealthMonitor();
}
// 默认健康监控器实例
const defaultHealthMonitor = new HealthMonitor();
/**
 * 获取默认健康监控器
 */
function getDefaultHealthMonitor() {
    return defaultHealthMonitor;
}
/**
 * 执行健康检查（使用默认监控器）
 */
function healthCheck(agent) {
    if (agent) {
        defaultHealthMonitor.setAgent(agent);
    }
    return defaultHealthMonitor.getHealthStatus();
}
/**
 * 执行健康检查（使用指定监控器）
 */
function checkHealth(monitor) {
    return monitor.getHealthStatus();
}
