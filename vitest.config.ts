import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: [
			// Mock workspace packages for testing
			{
				find: /^@originos\/pi-agent-adapter\/ai$/,
				replacement: path.resolve(__dirname, "./tests/mocks/@originos/pi-agent-adapter/ai.ts"),
			},
			{
				find: /^@originos\/pi-agent-adapter$/,
				replacement: path.resolve(__dirname, "./tests/mocks/@originos/pi-agent-adapter/index.ts"),
			},
			// Mock optional native deps
			{
				find: /^onnxruntime-node$/,
				replacement: path.resolve(__dirname, "./tests/mocks/onnxruntime-node.ts"),
			},
			{
				find: /^@\//,
				replacement: `${path.resolve(__dirname, "./packages/core/src")}/`,
			},
		],
	},
	// Mock Next.js modules globally
	test: {
		globals: true,
		environment: "jsdom",
		testTimeout: 30000, // 30 seconds for API calls
		include: ["src/**/*.{test,spec}.{ts,tsx}", "packages/**/src/**/*.{test,spec}.{ts,tsx}"],
		exclude: [
			"node_modules",
			".next",
			"dist",
			"out",
			"FluentOS-On-Web",
			"_bmad",
			"_bmad-output",
			"src/modules",
			"!src/modules/collaboration-runtime",
			"!src/modules/memory-core",
		],
		css: true,
		// Mock configuration
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: [
				"node_modules",
				".next",
				"dist",
				"out",
				"FluentOS-On-Web",
				"_bmad",
				"_bmad-output",
				"**/*.test.ts",
				"**/*.test.tsx",
				"**/*.spec.ts",
				"**/*.spec.tsx",
				"src/modules",
				"!src/modules/collaboration-runtime",
				"!src/modules/memory-core",
				"src/**/*.d.ts",
				"src/**/*.stories.tsx",
			],
		},
		mockReset: true,
		restoreMocks: true,
		server: {
			deps: {
				inline: ["vitest-canvas-mock"],
			},
		},
	},
	// Define constants for test environment
	define: {
		__NEXT_PUBLIC_API_URL: '"http://localhost:3000/api"',
	},
});
