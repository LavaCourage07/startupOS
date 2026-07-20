/**
 * Vitest setup file for pi-agent integration tests
 * This file configures module mocking for workspace packages
 */

import { beforeAll } from "vitest";
import path from "path";

console.log("Setting up test environment for pi-agent integration tests...");

// Log test environment info
beforeAll(() => {
	console.log("Test environment initialized with mocked workspace packages");
});

// Global test utilities
global.testUtils = {
	mockAgent: () => ({
		state: {
			isInitialized: true,
			sessionId: "test-session",
			projectContext: {
				projectId: "test-project",
				projectName: "Test Project",
				currentPath: "/test/path",
				userId: "test-user",
			},
			uiState: {
				isThinking: false,
				activeTools: [],
			},
		},
	}),
};
