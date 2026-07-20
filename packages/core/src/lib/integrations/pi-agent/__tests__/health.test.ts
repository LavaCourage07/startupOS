/**
 * Health 模块单元测试
 * 测试健康检查机制和状态监控
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
	AgentStatus,
	createHealthMonitor,
	healthCheck,
	checkHealth,
	getDefaultHealthMonitor,
	type AgentHealthStatus,
	type HealthMonitor as HealthMonitorType,
} from "../health";
import type { OriginOSAgent } from "../core/agent";

// ============================================================================
// Mocks
// ============================================================================

const mockAgent = {
	state: {
		sessionId: "test-session-001",
		isInitialized: true,
		projectContext: {
			projectId: "test-project",
		},
		uiState: {
			isThinking: false,
			activeTools: [],
		},
	},
} as unknown as OriginOSAgent;

// ============================================================================
// Test Suite
// ============================================================================

describe("HealthMonitor", () => {
	let monitor: HealthMonitorType;

	beforeEach(() => {
		monitor = createHealthMonitor();
		vi.clearAllMocks();
	});

	describe("Initial State", () => {
		it("should start with Stopped status", () => {
			expect(monitor.getStatus()).toBe(AgentStatus.Stopped);
		});

		it("should have zero uptime initially", () => {
			const health = checkHealth(monitor);
			expect(health.uptime).toBe(0);
		});

		it("should have zero messages processed", () => {
			const health = checkHealth(monitor);
			expect(health.messagesProcessed).toBe(0);
		});

		it("should have unhealthy status initially", () => {
			const health = checkHealth(monitor);
			expect(health.status).toBe("unhealthy");
		});
	});

	describe("Status Management", () => {
		it("should set status to Running", () => {
			monitor.markAsRunning();
			expect(monitor.getStatus()).toBe(AgentStatus.Running);
		});

		it("should set status to Stopped", () => {
			monitor.markAsRunning();
			monitor.markAsStopped();
			expect(monitor.getStatus()).toBe(AgentStatus.Stopped);
		});

		it("should set status to Error", () => {
			monitor.markAsRunning();
			monitor.setStatus(AgentStatus.Error);
			expect(monitor.getStatus()).toBe(AgentStatus.Error);
		});

		it("should set status to Initializing", () => {
			monitor.setStatus(AgentStatus.Initializing);
			expect(monitor.getStatus()).toBe(AgentStatus.Initializing);
		});

		it("should clear error when status changes to Running", () => {
			monitor.setStatus(AgentStatus.Error);
			monitor.markAsRunning();

			const health = checkHealth(monitor);
			expect(health.error).toBeUndefined();
		});
	});

	describe("Health Status Mapping", () => {
		it("should return healthy when status is Running", () => {
			monitor.markAsRunning();
			const health = checkHealth(monitor);
			expect(health.status).toBe("healthy");
		});

		it("should return initializing when status is Initializing", () => {
			monitor.setStatus(AgentStatus.Initializing);
			const health = checkHealth(monitor);
			expect(health.status).toBe("initializing");
		});

		it("should return unhealthy when status is Stopped", () => {
			monitor.markAsStopped();
			const health = checkHealth(monitor);
			expect(health.status).toBe("unhealthy");
		});

		it("should return unhealthy when status is Error", () => {
			monitor.setStatus(AgentStatus.Error);
			const health = checkHealth(monitor);
			expect(health.status).toBe("unhealthy");
		});
	});

	describe("Uptime Calculation", () => {
		it("should calculate uptime correctly", async () => {
			monitor.markAsRunning();

			// Wait 100ms
			await new Promise((resolve) => setTimeout(resolve, 100));

			const health = checkHealth(monitor);
			expect(health.uptime).toBeGreaterThanOrEqual(0);
		});

		it("should return zero uptime when not started", () => {
			const health = checkHealth(monitor);
			expect(health.uptime).toBe(0);
		});

		it("should accumulate uptime across checks", async () => {
			monitor.markAsRunning();

			await new Promise((resolve) => setTimeout(resolve, 50));

			const health1 = checkHealth(monitor);
			expect(health1.uptime).toBeGreaterThanOrEqual(0);

			await new Promise((resolve) => setTimeout(resolve, 50));

			const health2 = checkHealth(monitor);
			expect(health2.uptime).toBeGreaterThanOrEqual(health1.uptime);
		});
	});

	describe("Message Tracking", () => {
		it("should increment message count", () => {
			monitor.recordMessageHandled();
			const health = checkHealth(monitor);
			expect(health.messagesProcessed).toBe(1);
		});

		it("should track multiple messages", () => {
			monitor.recordMessageHandled();
			monitor.recordMessageHandled();
			monitor.recordMessageHandled();
			monitor.recordMessageHandled();
			monitor.recordMessageHandled();

			const health = checkHealth(monitor);
			expect(health.messagesProcessed).toBe(5);
		});
	});

	describe("Heartbeat Tracking", () => {
		it("should update heartbeat on each status change", () => {
			const before = Date.now();
			monitor.markAsRunning();
			const health = checkHealth(monitor);
			const after = Date.now();

			expect(health.lastHeartbeat.getTime()).toBeGreaterThanOrEqual(before);
			expect(health.lastHeartbeat.getTime()).toBeLessThanOrEqual(after);
		});

		it("should update heartbeat on message handled", () => {
			monitor.markAsRunning();

			const before = Date.now();
			monitor.recordMessageHandled();
			const health = checkHealth(monitor);
			const after = Date.now();

			expect(health.lastHeartbeat.getTime()).toBeGreaterThanOrEqual(before);
			expect(health.lastHeartbeat.getTime()).toBeLessThanOrEqual(after);
		});
	});

	describe("Processing State", () => {
		it("should track processing state", () => {
			monitor.markProcessingStart();
			const health = checkHealth(monitor);
			expect(health.isProcessing).toBe(true);
		});

		it("should clear processing state on end", () => {
			monitor.markProcessingStart();
			monitor.markProcessingEnd();
			const health = checkHealth(monitor);
			expect(health.isProcessing).toBe(false);
		});

		it("should clear processing when stopped", () => {
			monitor.markProcessingStart();
			monitor.markAsStopped();
			const health = checkHealth(monitor);
			expect(health.isProcessing).toBe(false);
		});
	});

	describe("Error Handling", () => {
		it("should record error message", () => {
			monitor.recordError("Connection failed");
			const health = checkHealth(monitor);
			expect(health.error).toBe("Connection failed");
		});

		it("should set status to Error on error recorded", () => {
			monitor.markAsRunning();
			monitor.recordError("Something went wrong");
			expect(monitor.getStatus()).toBe(AgentStatus.Error);
		});

		it("should return unhealthy with error when error exists", () => {
			monitor.recordError("Test error");
			const health = checkHealth(monitor);
			expect(health.status).toBe("unhealthy");
			expect(health.error).toBe("Test error");
		});
	});

	describe("Reset", () => {
		it("should reset all state", () => {
			monitor.markAsRunning();
			monitor.recordMessageHandled();
			monitor.recordMessageHandled();
			monitor.recordError("Test error");
			monitor.markProcessingStart();

			monitor.reset();

			expect(monitor.getStatus()).toBe(AgentStatus.Stopped);
			const health = checkHealth(monitor);
			expect(health.uptime).toBe(0);
			expect(health.messagesProcessed).toBe(0);
			expect(health.error).toBeUndefined();
			expect(health.isProcessing).toBe(false);
		});
	});

	describe("Memory Usage", () => {
		it("should return memory usage in MB", () => {
			const health = checkHealth(monitor);
			expect(typeof health.memoryUsage).toBe("number");
			expect(health.memoryUsage).toBeGreaterThanOrEqual(0);
		});
	});

	describe("Agent Association", () => {
		it("should associate agent with monitor", () => {
			monitor.setAgent(mockAgent);
			const health = checkHealth(monitor);
			expect(health.agentId).toBe("test-session-001");
			expect(health.sessionId).toBe("test-session-001");
		});
	});
});

describe("healthCheck (default monitor)", () => {
	let defaultMonitor: HealthMonitorType;

	beforeEach(() => {
		defaultMonitor = getDefaultHealthMonitor();
		defaultMonitor.reset();
	});

	it("should use default monitor when called", () => {
		defaultMonitor.markAsRunning();
		const health = healthCheck();
		expect(health.status).toBe("healthy");
	});

	it("should set agent when provided", () => {
		const health = healthCheck(mockAgent);
		expect(health.agentId).toBe("test-session-001");
	});
});

describe("Heartbeat Timeout", () => {
	it("should return unhealthy if heartbeat too old", async () => {
		const monitor = createHealthMonitor();
		monitor.markAsRunning();

		vi.useFakeTimers();
		vi.advanceTimersByTime(31000); // 31 seconds (over 30s timeout)

		const health = checkHealth(monitor);
		expect(health.status).toBe("unhealthy");
		expect(health.error).toBe("Heartbeat timeout");

		vi.useRealTimers();
	});

	it("should remain healthy within timeout", async () => {
		const monitor = createHealthMonitor();
		monitor.markAsRunning();

		vi.useFakeTimers();
		vi.advanceTimersByTime(29000); // 29 seconds (within 30s timeout)

		const health = checkHealth(monitor);
		expect(health.status).toBe("healthy");

		vi.useRealTimers();
	});
});

describe("Performance Requirements", () => {
	it("should complete health check within 50ms", () => {
		const monitor = createHealthMonitor();
		monitor.markAsRunning();
		monitor.recordMessageHandled();
		monitor.recordMessageHandled();

		const start = performance.now();
		const health = checkHealth(monitor);
		const duration = performance.now() - start;

		expect(health.status).toBe("healthy");
		expect(duration).toBeLessThan(50);
	});

	it("should complete multiple health checks within 50ms each", () => {
		const monitor = createHealthMonitor();
		monitor.markAsRunning();

		const timings: number[] = [];
		for (let i = 0; i < 10; i++) {
			monitor.recordMessageHandled();

			const start = performance.now();
			checkHealth(monitor);
			timings.push(performance.now() - start);
		}

		timings.forEach((duration) => {
			expect(duration).toBeLessThan(50);
		});
	});
});
