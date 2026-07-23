/**
 * Tests for pi-agent Skill Framework
 */

import { describe, it, expect } from "vitest";
import {
	loadSkills,
	formatSkillsForPrompt,
	loadSkillContent,
	getDefaultSkillPaths,
	getBundledSkillDir,
	getBundledSkillDirs,
	type Skill,
} from "../core/skills.js";
import {
	createSkillManager,
	type SkillInvocationContext,
} from "../core/skills.middleware.js";
import { basename, join, resolve } from "path";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { getMonorepoRoot, setMonorepoRoot } from "../../../paths";

// Get test fixture directory
const testDir = resolve(process.cwd(), "src/lib/integrations/pi-agent/__tests__/fixtures");

describe("Skill Framework", () => {
	describe("loadSkills", () => {
		it("should load skills from directory", () => {
			const { skills, diagnostics } = loadSkills({
				cwd: testDir,
				includeDefaults: false,
				skillPaths: [join(testDir, "skills")],
			});

			// We expect at least some skills loaded if fixtures exist
			expect(Array.isArray(skills)).toBe(true);
			expect(Array.isArray(diagnostics)).toBe(true);
		});

		it("should format skills for prompt", () => {
			const skill: Skill = {
				name: "test-skill",
				description: "A test skill for testing purposes",
				filePath: "/test/path/skills/test-skill/SKILL.md",
				baseDir: "/test/path/skills/test-skill",
				source: "project",
				disableModelInvocation: false,
			};

			const formatted = formatSkillsForPrompt([skill]);

			expect(formatted).toContain("<available_skills>");
			expect(formatted).toContain("<skill>");
			expect(formatted).toContain("<name>test-skill</name>");
			expect(formatted).toContain("<description>A test skill for testing purposes</description>");
			expect(formatted).contains("</available_skills>");
		});

		it("should exclude disabled model invocation skills from prompt", () => {
			const skills: Skill[] = [
				{
					name: "enabled-skill",
					description: "An enabled skill",
					filePath: "/test/SKILL.md",
					baseDir: "/test",
					source: "project",
					disableModelInvocation: false,
				},
				{
					name: "disabled-skill",
					description: "A disabled skill",
					filePath: "/test2/SKILL.md",
					baseDir: "/test2",
					source: "project",
					disableModelInvocation: true,
				},
			];

			const formatted = formatSkillsForPrompt(skills);

			expect(formatted).toContain("enabled-skill");
			expect(formatted).not.toContain("disabled-skill");
		});

		it("should return empty string for no skills", () => {
			const formatted = formatSkillsForPrompt([]);
			expect(formatted).toBe("");
		});

		it("should return empty string for all disabled skills", () => {
			const skills: Skill[] = [
				{
					name: "skill-1",
					description: "Skill 1",
					filePath: "/test1/SKILL.md",
					baseDir: "/test1",
					source: "project",
					disableModelInvocation: true,
				},
			];

			const formatted = formatSkillsForPrompt(skills);
			expect(formatted).toBe("");
		});

		it("should keep skill-creator-app and project-skill-creator distinct", () => {
			const { skills } = loadSkills({
				cwd: getMonorepoRoot(),
				includeDefaults: false,
				skillPaths: [
					join(getBundledSkillDir(), "skill-creator-app"),
					join(getBundledSkillDir(), "project-skill-creator"),
				],
			});

			expect(skills.find(skill => skill.name === "skill-creator-app")?.baseDir).toContain(
				join("templates", "skills", "skill-creator-app")
			);
			expect(skills.find(skill => skill.name === "project-skill-creator")?.baseDir).toContain(
				join("templates", "skills", "project-skill-creator")
			);
		});

		it("should load bundled template skills without copying them into data skills", () => {
			const originalRoot = getMonorepoRoot();
			const originalDataRoot = process.env.DATA_ROOT;
			const tempRoot = mkdtempSync(join(tmpdir(), "originos-skill-template-"));
			const monorepoRoot = join(tempRoot, "repo");
			const dataRoot = join(tempRoot, "data");
			const bundledSkillDir = join(monorepoRoot, "templates", "skills", "demo-skill");
			mkdirSync(bundledSkillDir, { recursive: true });
			writeFileSync(
				join(bundledSkillDir, "SKILL.md"),
				[
					"---",
					"name: demo-skill",
					"description: Demo bundled skill",
					"---",
					"",
					"Use this demo skill.",
				].join("\n"),
				"utf8",
			);

			try {
				setMonorepoRoot(monorepoRoot);
				process.env.DATA_ROOT = dataRoot;

				const result = loadSkills({ includeDefaults: true });
				const copiedSkillPath = join(dataRoot, "skills", "demo-skill", "SKILL.md");
				const seededSkill = result.skills.find((skill) => skill.name === "demo-skill");

				expect(existsSync(copiedSkillPath)).toBe(false);
				expect(seededSkill?.source).toBe("bundled");
				expect(seededSkill?.baseDir).toBe(bundledSkillDir);
			} finally {
				setMonorepoRoot(originalRoot);
				if (originalDataRoot === undefined) {
					delete process.env.DATA_ROOT;
				} else {
					process.env.DATA_ROOT = originalDataRoot;
				}
			}
		});

		it("should resolve bundled skills from Electron resources when running standalone server as node", () => {
			const originalRoot = getMonorepoRoot();
			const originalDataRoot = process.env.DATA_ROOT;
			const originalMonorepoRoot = process.env.MONOREPO_ROOT;
			const originalElectronRunAsNode = process.env.ELECTRON_RUN_AS_NODE;
			const originalResourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
			const tempRoot = mkdtempSync(join(tmpdir(), "originos-skill-resources-"));
			const resourcesRoot = join(tempRoot, "resources");
			const fallbackRoot = join(tempRoot, "missing-repo");
			const dataRoot = join(tempRoot, "data");
			const bundledSkillDir = join(resourcesRoot, "templates", "skills", "skill-creator-app");
			mkdirSync(bundledSkillDir, { recursive: true });
			writeFileSync(
				join(bundledSkillDir, "SKILL.md"),
				[
					"---",
					"name: skill-creator-app",
					"code: skill-creator-app",
					"description: Skill creator bundled from resources",
					"---",
					"",
					"Use this packaged skill.",
				].join("\n"),
				"utf8",
			);

			try {
				setMonorepoRoot(fallbackRoot);
				process.env.DATA_ROOT = dataRoot;
				process.env.MONOREPO_ROOT = fallbackRoot;
				process.env.ELECTRON_RUN_AS_NODE = "1";
				Object.defineProperty(process, "resourcesPath", {
					value: resourcesRoot,
					configurable: true,
				});

				const dirs = getBundledSkillDirs();
				const result = loadSkills({ includeDefaults: true });
				const loadedSkill = result.skills.find((skill) => skill.code === "skill-creator-app");

				expect(dirs[0]).toBe(join(resourcesRoot, "templates", "skills"));
				expect(getBundledSkillDir()).toBe(join(resourcesRoot, "templates", "skills"));
				expect(loadedSkill?.source).toBe("bundled");
				expect(loadedSkill?.baseDir).toBe(bundledSkillDir);
				expect(existsSync(join(dataRoot, "skills", "skill-creator-app", "SKILL.md"))).toBe(false);
			} finally {
				setMonorepoRoot(originalRoot);
				if (originalDataRoot === undefined) {
					delete process.env.DATA_ROOT;
				} else {
					process.env.DATA_ROOT = originalDataRoot;
				}
				if (originalMonorepoRoot === undefined) {
					delete process.env.MONOREPO_ROOT;
				} else {
					process.env.MONOREPO_ROOT = originalMonorepoRoot;
				}
				if (originalElectronRunAsNode === undefined) {
					delete process.env.ELECTRON_RUN_AS_NODE;
				} else {
					process.env.ELECTRON_RUN_AS_NODE = originalElectronRunAsNode;
				}
				if (originalResourcesPath === undefined) {
					delete (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
				} else {
					Object.defineProperty(process, "resourcesPath", {
						value: originalResourcesPath,
						configurable: true,
					});
				}
			}
		});
	});

	describe("SkillManager", () => {
		it("should create a skill manager", () => {
			const manager = createSkillManager({
				cwd: testDir,
				includeDefaults: false,
			});

			expect(manager).toBeDefined();
			expect(manager.getAllSkills()).toBeInstanceOf(Array);
		});

		it("should get skill by name", () => {
			const manager = createSkillManager();
			const skill = manager.getSkill("non-existent");

			expect(skill).toBeUndefined();
		});

		it("should enable and disable skills", () => {
			const manager = createSkillManager();
			const result = manager.setSkillEnabled("non-existent", true);

			expect(result).toBe(false);
		});

		it("should search skills", () => {
			const manager = createSkillManager();
			const results = manager.search("test");

			expect(Array.isArray(results)).toBe(true);
		});

		it("should handle skill invocation", () => {
			const manager = createSkillManager();
			const context: SkillInvocationContext = {
				skillName: "non-existent",
				sessionId: "test-session",
				workspace: testDir,
			};

			const result = manager.invoke(context);

			expect(result.success).toBe(false);
			expect(result.error).toContain("not found");
		});

		it("should record usage stats", () => {
			const manager = createSkillManager();
			// Add a skill manually for testing
			const skillName = "test-skill";

			const before = manager.getUsageStats(skillName);
			expect(before.count).toBeUndefined();

			manager.recordUsage(skillName);

			const after = manager.getUsageStats(skillName);
			expect(after.count).toBeUndefined(); // Still undefined for non-existent skill
		});
	});

	describe("getDefaultSkillPaths", () => {
		it("should return default skill paths", () => {
			const paths = getDefaultSkillPaths(testDir);

			expect(paths.bundled).toContain(join("templates", "skills"));
			expect(paths.user).toContain("data");
			expect(paths.user).toContain("skills");
			expect(paths.project).toContain(".originos");
			expect(paths.project).toContain("skills");
		});
	});
});
