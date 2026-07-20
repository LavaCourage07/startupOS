/**
 * Tests for working directory routing across the entire agent/skill pipeline.
 *
 * Rules:
 * 1. System apps (role-agent-creator, skill-creator-app, agent-creator) → workingDirectory = project root (process.cwd())
 * 2. User-installed skills → workingDirectory is the semantic workspace root; outputDir is only an explicit artifact directory
 * 3. Role agents → workingDirectory = data/agents/{id}/
 * 4. Tool layer only receives a single workingDirectory, never platform concepts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join, win32 as pathWin32 } from 'path';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import os from 'os';
import { isSystemApp, SYSTEM_APPS } from '../../../../../../../web/src/config/system-apps';
import { getToolContextManager, setToolContext, getToolContext } from '../context';
import { fileTools } from '../file-tools';

const CWD = process.cwd();

// ============================================================================
// Helpers
// ============================================================================

function tempDir(): string {
	return join(os.tmpdir(), `originos-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
}

// ============================================================================
// 1. System app configuration
// ============================================================================

describe('System app configuration', () => {
	it('has all expected system apps registered', () => {
		const codes = SYSTEM_APPS.map(a => a.code);
		expect(codes).toContain('role-agent-creator');
		expect(codes).toContain('skill-creator-app');
		expect(codes).toContain('agent-creator');
	});

	it('isSystemApp returns true for system apps', () => {
		expect(isSystemApp('role-agent-creator')).toBe(true);
		expect(isSystemApp('skill-creator-app')).toBe(true);
		expect(isSystemApp('agent-creator')).toBe(true);
	});

	it('isSystemApp returns false for user-installed skills', () => {
		expect(isSystemApp('my-custom-skill')).toBe(false);
		expect(isSystemApp('prd-generator')).toBe(false);
		expect(isSystemApp('non-existent')).toBe(false);
	});

});

// ============================================================================
// 2. Working directory resolution by scenario
// ============================================================================

describe('Working directory resolution', () => {
	let tmpRoot: string;
	let testDir: string;

	beforeEach(() => {
		tmpRoot = tempDir();
		testDir = join(tmpRoot, 'workspace');
		mkdirSync(testDir, { recursive: true });
		// Simulate process.cwd() change
		vi.spyOn(process, 'cwd').mockReturnValue(testDir);
	});

	afterEach(() => {
		if (existsSync(tmpRoot)) {
			rmSync(tmpRoot, { recursive: true, force: true });
		}
		vi.restoreAllMocks();
	});

	it('system skill → agentWorkDir is explicitly set to project root', () => {
		const currentSkill = 'role-agent-creator';

		// Simulates SkillDialog.tsx logic:
		//   const isSystemSkill = isSystemApp(currentSkill);
		//   const agentWorkDir = resolveSkillWorkingDirectory(...) => process.cwd()
		const isSystemSkill = isSystemApp(currentSkill);
		const agentWorkDir = isSystemSkill ? process.cwd() : '/some/output/dir';

		expect(isSystemSkill).toBe(true);
		expect(agentWorkDir).toBe(testDir);

		const toolCtxWorkingDir = agentWorkDir;
		expect(toolCtxWorkingDir).toBe(testDir);

		const resolvedDir = toolCtxWorkingDir;
		expect(resolvedDir).toBe(testDir);
	});

	it('user-installed skill can keep workspace and output directories separate', () => {
		const currentSkill = 'my-custom-skill';
		const workspaceDir = testDir;
		const outputDir = join(testDir, 'data', 'skills', 'my-custom-skill');

		const isSystemSkill = isSystemApp(currentSkill);
		const agentWorkDir = isSystemSkill ? process.cwd() : workspaceDir;

		expect(isSystemSkill).toBe(false);
		expect(agentWorkDir).toBe(workspaceDir);

		const toolCtxWorkingDir = agentWorkDir;
		expect(toolCtxWorkingDir).toBe(workspaceDir);

		const resolvedDir = toolCtxWorkingDir;
		expect(resolvedDir).toBe(workspaceDir);
		expect(outputDir).toBe(join(testDir, 'data', 'skills', 'my-custom-skill'));
	});

	it('relative paths from system skill resolve under project root', () => {
		// System skill creates agents in data/agents/{id}/
		// SKILL.md uses relative path: data/agents/{role-agent-id}/
		// CWD = project root → data/agents/ resolves correctly
		const relativePath = 'data/agents/test-agent';
		const resolved = join(process.cwd(), relativePath);
		expect(resolved).toBe(join(testDir, 'data', 'agents', 'test-agent'));
	});

	it('relative paths from system skill do NOT create under skills dir', () => {
		// Bug scenario: if CWD was data/skills/role-agent-creator/,
		// then "data/agents/xxx" would resolve to:
		//   data/skills/role-agent-creator/data/agents/xxx (WRONG)
		const wrongCwd = join(testDir, 'data', 'skills', 'role-agent-creator');
		const relativePath = 'data/agents/test-agent';
		const wrongResolved = join(wrongCwd, relativePath);
		expect(wrongResolved).toContain(join('data', 'skills', 'role-agent-creator', 'data', 'agents'));
		expect(wrongResolved).not.toBe(join(testDir, 'data', 'agents', 'test-agent'));
	});
});

// ============================================================================
// 3. Tool context management
// ============================================================================

describe('Tool context management', () => {
	let tmpRoot: string;
	let testDir: string;

	beforeEach(() => {
		tmpRoot = tempDir();
		testDir = join(tmpRoot, 'workspace');
		mkdirSync(testDir, { recursive: true });
		vi.spyOn(process, 'cwd').mockReturnValue(testDir);
		getToolContextManager().clear();
	});

	afterEach(() => {
		if (existsSync(tmpRoot)) {
			rmSync(tmpRoot, { recursive: true, force: true });
		}
		vi.restoreAllMocks();
	});

	it('agent-manager sets workingDirectory for system skill session', () => {
		const sessionId = 'session-sys-skill';
		const agentBaseDir = testDir;

		setToolContext(sessionId, { sessionId, workingDirectory: agentBaseDir });
		getToolContextManager().setDefaultContext({ sessionId, workingDirectory: agentBaseDir });

		const ctx = getToolContext(sessionId);
		expect(ctx.workingDirectory).toBe(testDir);
		// No platform concepts
		expect('agentBaseDir' in ctx).toBe(false);
		expect('projectContext' in ctx).toBe(false);
	});

	it('agent-manager exposes only workingDirectory to tools', () => {
		const sessionId = 'session-user-skill';
		const workspaceDir = testDir;

		setToolContext(sessionId, { sessionId, workingDirectory: workspaceDir });
		getToolContextManager().setDefaultContext({ sessionId, workingDirectory: workspaceDir });

		const ctx = getToolContext(sessionId);
		expect(ctx.workingDirectory).toBe(workspaceDir);
		expect(ctx).not.toHaveProperty('skillOutputDir');
	});

	it('tool resolves workingDirectory from injected tool context', () => {
		const sessionId = 'session-test';
		const workDir = join(testDir, 'data', 'agents', 'test-agent');

		setToolContext(sessionId, { sessionId, workingDirectory: workDir });
		getToolContextManager().setDefaultContext({ sessionId, workingDirectory: workDir });

		const ctx = getToolContext(sessionId);

		const resolved = ctx.workingDirectory;
		expect(resolved).toBe(workDir);
	});

	it('tool context without workingDirectory remains undefined until caller injects it', () => {
		const sessionId = 'session-fallback';

		setToolContext(sessionId, { sessionId });
		getToolContextManager().setDefaultContext({ sessionId });

		const ctx = getToolContext(sessionId);
		expect(ctx.workingDirectory).toBeUndefined();
	});
});

// ============================================================================
// 4. End-to-end routing simulation
// ============================================================================

describe('End-to-end working directory routing', () => {
	let tmpRoot: string;
	let testDir: string;

	beforeEach(() => {
		tmpRoot = tempDir();
		testDir = join(tmpRoot, 'workspace');
		mkdirSync(testDir, { recursive: true });
		// Create realistic directory structure
		mkdirSync(join(testDir, 'data', 'agents'), { recursive: true });
		mkdirSync(join(testDir, 'data', 'skills', 'my-skill'), { recursive: true });
		mkdirSync(join(testDir, 'data', 'skills', 'role-agent-creator'), { recursive: true });
		mkdirSync(join(testDir, '.claude', 'skills', 'role-agent-creator'), { recursive: true });

		vi.spyOn(process, 'cwd').mockReturnValue(testDir);
		getToolContextManager().clear();
	});

	afterEach(() => {
		if (existsSync(tmpRoot)) {
			rmSync(tmpRoot, { recursive: true, force: true });
		}
		vi.restoreAllMocks();
	});

	it('system app role-agent-creator creates agents in data/agents/', () => {
		// Step 1: SkillDialog determines working directory
		const skillName = 'role-agent-creator';
		const isSystemSkill = isSystemApp(skillName);
		const agentWorkDir = isSystemSkill ? process.cwd() : '/should/not/be/this';

		// Step 2: Agent-manager sets tool context
		const sessionId = 'session-role-agent';
		setToolContext(sessionId, { sessionId, workingDirectory: agentWorkDir });
		getToolContextManager().setDefaultContext({ sessionId, workingDirectory: agentWorkDir });

		// Step 3: Tool resolves working directory
		const toolCtx = getToolContext(sessionId);
		const workingDir = toolCtx.workingDirectory!;

		// Step 4: Simulate SKILL.md relative path resolution
		// role-agent-creator SKILL.md says: save to data/agents/{id}/
		const relativeSavePath = 'data/agents/new-role-agent';
		const finalPath = join(workingDir, relativeSavePath);

		expect(finalPath).toBe(join(testDir, 'data', 'agents', 'new-role-agent'));
		expect(finalPath).not.toContain('skills');
	});

	it('system app skill-creator-app creates skills in data/skills/', () => {
		const skillName = 'skill-creator-app';
		const isSystemSkill = isSystemApp(skillName);
		const agentWorkDir = isSystemSkill ? process.cwd() : '/wrong/path';

		expect(isSystemSkill).toBe(true);
		expect(agentWorkDir).toBe(testDir);

		const sessionId = 'session-skill-creator';
		setToolContext(sessionId, { sessionId, workingDirectory: agentWorkDir });
		getToolContextManager().setDefaultContext({ sessionId, workingDirectory: agentWorkDir });

		const toolCtx = getToolContext(sessionId);
		const workingDir = toolCtx.workingDirectory!;

		// skill-creator saves to data/skills/{new-skill}/
		const relativeSavePath = 'data/skills/new-skill/skill.md';
		const finalPath = join(workingDir, relativeSavePath);

		expect(finalPath).toBe(join(testDir, 'data', 'skills', 'new-skill', 'skill.md'));
	});

	it('user-installed skill can write to an explicit output subtree from workspace root', () => {
		const skillName = 'my-skill';
		const workspaceDir = testDir;
		const outputDir = join(testDir, 'data', 'skills', 'my-skill');

		const isSystemSkill = isSystemApp(skillName);
		const agentWorkDir = isSystemSkill ? process.cwd() : workspaceDir;

		expect(isSystemSkill).toBe(false);
		expect(agentWorkDir).toBe(workspaceDir);
		expect(outputDir).toBe(join(testDir, 'data', 'skills', 'my-skill'));

		const sessionId = 'session-my-skill';
		setToolContext(sessionId, { sessionId, workingDirectory: agentWorkDir });
		getToolContextManager().setDefaultContext({ sessionId, workingDirectory: agentWorkDir });

		const toolCtx = getToolContext(sessionId);
		const workingDir = toolCtx.workingDirectory!;

		// User skill explicitly writes into its output subtree
		const relativeSavePath = 'data/skills/my-skill/output/result.txt';
		const finalPath = join(workingDir, relativeSavePath);

		expect(finalPath).toBe(join(testDir, 'data', 'skills', 'my-skill', 'output', 'result.txt'));
	});

	it('no tool should receive platform concepts in its context', () => {
		const sessionId = 'session-check';
		setToolContext(sessionId, {
			sessionId,
			workingDirectory: testDir,
		});

		const ctx = getToolContext(sessionId);

		// Verify no platform concepts exist in the context interface
		expect(ctx).not.toHaveProperty('agentBaseDir');
		expect(ctx).not.toHaveProperty('projectContext');
		expect(ctx).not.toHaveProperty('useProjectRoot');
		expect(ctx).not.toHaveProperty('skillOutputDir');

		// Only allowed properties
		const keys = Object.keys(ctx);
		const allowedKeys = ['sessionId', 'workingDirectory'];
		for (const key of keys) {
			expect(allowedKeys).toContain(key);
		}
	});

	it('file tools stay rooted at the injected workingDirectory', async () => {
		const sessionId = 'session-solution-output';
		const workingDirectory = testDir;
		mkdirSync(workingDirectory, { recursive: true });

		setToolContext(sessionId, { sessionId, workingDirectory });
		getToolContextManager().setDefaultContext({ sessionId, workingDirectory });

		const writeFileTool = fileTools.find(tool => tool.name === 'write_file');
		expect(writeFileTool).toBeDefined();

		const result = await writeFileTool!.execute('call-write-agent', {
			filePath: 'solutions/agents/new-role-agent/Agent.md',
			content: '# New Role Agent\n',
		});

		expect((result.details as { success?: boolean }).success).toBe(true);
		const expectedPath = join(testDir, 'solutions', 'agents', 'new-role-agent', 'Agent.md');
		const wrongPath = join(testDir, 'agents', 'new-role-agent', 'Agent.md');
		expect(readFileSync(expectedPath, 'utf-8')).toBe('# New Role Agent\n');
		expect(existsSync(wrongPath)).toBe(false);
	});

	it('file tools route data/agents paths to DATA_ROOT instead of the current skill directory', async () => {
		const sessionId = 'session-data-root-routing';
		const dataRoot = join(testDir, 'data');
		const skillWorkingDirectory = join(dataRoot, 'skills', 'role-agent-creator');
		mkdirSync(skillWorkingDirectory, { recursive: true });
		vi.stubEnv('DATA_ROOT', dataRoot);

		setToolContext(sessionId, { sessionId, workingDirectory: skillWorkingDirectory });
		getToolContextManager().setDefaultContext({ sessionId, workingDirectory: skillWorkingDirectory });

		const writeFileTool = fileTools.find(tool => tool.name === 'write_file');
		expect(writeFileTool).toBeDefined();

		const result = await writeFileTool!.execute('call-write-data-agent', {
			filePath: 'data/agents/product-manager/Agent.md',
			content: '# Product Manager\n',
		});

		expect((result.details as { success?: boolean }).success).toBe(true);
		expect((result.details as { filePath?: string }).filePath).toBe('data/agents/product-manager/Agent.md');
		expect(readFileSync(join(dataRoot, 'agents', 'product-manager', 'Agent.md'), 'utf-8')).toBe('# Product Manager\n');
		expect(existsSync(join(skillWorkingDirectory, 'data', 'agents', 'product-manager', 'Agent.md'))).toBe(false);
	});

	it('file tools normalize Windows-style separators in returned paths', async () => {
		const sessionId = 'session-windows-separators';
		const dataRoot = join(testDir, 'data');
		mkdirSync(dataRoot, { recursive: true });
		vi.stubEnv('DATA_ROOT', dataRoot);

		setToolContext(sessionId, { sessionId, workingDirectory: join(dataRoot, 'skills', 'skill-creator-app') });
		getToolContextManager().setDefaultContext({ sessionId, workingDirectory: join(dataRoot, 'skills', 'skill-creator-app') });

		const writeFileTool = fileTools.find(tool => tool.name === 'write_file');
		expect(writeFileTool).toBeDefined();

		const result = await writeFileTool!.execute('call-write-win-path', {
			filePath: 'data\\skills\\new-skill\\SKILL.md',
			content: '# New Skill\n',
		});

		expect((result.details as { success?: boolean }).success).toBe(true);
		expect((result.details as { filePath?: string }).filePath).toBe('data/skills/new-skill/SKILL.md');
		expect(readFileSync(join(dataRoot, 'skills', 'new-skill', 'SKILL.md'), 'utf-8')).toBe('# New Skill\n');
	});

	it('Windows-style workingDirectory flows through tool context unchanged (no MSYS /workspace)', async () => {
		// Windows 打包版技能会话：workingDirectory 注入 Windows 绝对路径，
		// tool context 必须原样保留，不得被改写成 MSYS 风格（如 /workspace）。
		const sessionId = 'session-windows-cwd';
		const windowsWorkDir = 'C:\\Users\\testuser\\AppData\\Roaming\\OriginOS\\data\\skills\\my-skill';

		setToolContext(sessionId, { sessionId, workingDirectory: windowsWorkDir });
		getToolContextManager().setDefaultContext({ sessionId, workingDirectory: windowsWorkDir });

		const ctx = getToolContext(sessionId);
		expect(ctx.workingDirectory).toBe(windowsWorkDir);
		// 关键：不得被改写为 MSYS 挂载根 /workspace
		expect(ctx.workingDirectory).not.toContain('/workspace');
		expect(ctx.workingDirectory).not.toMatch(/^\/c\//);
		// path.win32 能正确识别这是绝对路径（在任何平台都成立）
		expect(pathWin32.isAbsolute(windowsWorkDir)).toBe(true);
	});
});
