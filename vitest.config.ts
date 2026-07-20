import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@/components": path.resolve(__dirname, "./src/components"),
			"@/lib": path.resolve(__dirname, "./src/lib"),
			"@/types": path.resolve(__dirname, "./src/types"),
			"@/modules": path.resolve(__dirname, "./src/modules"),
			// Mock workspace packages for testing
			"@mariozechner/agent": path.resolve(__dirname, "./src/__tests__/mocks/@mariozechner/agent.ts"),
			"@mariozechner/pi-ai": path.resolve(__dirname, "./src/__tests__/mocks/@mariozechner/pi-ai.ts"),
			// Mock optional native deps
			"onnxruntime-node": path.resolve(__dirname, "./src/__tests__/mocks/onnxruntime-node.ts"),
		},
	},
	// Mock Next.js modules globally
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/__tests__/setup.ts"],
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

