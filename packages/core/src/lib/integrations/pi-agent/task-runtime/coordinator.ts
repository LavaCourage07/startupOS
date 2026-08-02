import type { AgentMessage, AgentTool } from "@originos/pi-agent-adapter";
import type { OriginOSAgent } from "../core/agent";
import {
	TaskContinuationController,
	type AgentTaskContinuationDecision,
} from "./continuation-controller";
import {
	createAgentTaskProgressFingerprint,
	projectPiTaskSnapshot,
	type PiTaskSnapshotLike,
} from "./projection";
import {
	AGENT_TASK_RUNTIME_PROTOCOL_VERSION,
	createIdleAgentTaskExecutionState,
	type AgentTaskExecutionStateV1,
	type AgentTaskProjectionV1,
	type AgentTaskRuntimePersistenceV1,
	type AgentTaskRuntimeSnapshotV1,
	type ControlAgentTaskRequestV1,
	type CreateAgentTaskRequestV1,
} from "./types";

type TaskBranchEntry = Record<string, unknown> & { id: string };

interface TaskHostScope {
	sessionId: string;
	cursor: string | null;
	revision: number;
	bridgeEpoch: number;
}

interface TaskHostTool {
	name: string;
	label: string;
	description: string;
	parameters: unknown;
	execute(
		toolCallId: string,
		input: Record<string, unknown>,
		signal?: AbortSignal,
		onUpdate?: (update: unknown) => void,
	): Promise<unknown>;
}

interface TaskHostState {
	scope: TaskHostScope;
	snapshot: PiTaskSnapshotLike;
}

interface TaskSessionHost {
	restore(entries: readonly TaskBranchEntry[]): Promise<TaskHostState>;
	getSnapshot(): PiTaskSnapshotLike;
	getScope(): TaskHostScope;
	getAgentTools(): readonly TaskHostTool[];
	invoke(command: {
		version: 1;
		requestId: string;
		toolName: string;
		scope: {
			sessionId: string;
			expectedCursor: string | null;
			expectedRevision: number;
			bridgeEpoch: number;
		};
		input: Record<string, unknown>;
	}): Promise<unknown>;
	subscribeState(listener: (state: TaskHostState) => void): () => void;
	invalidate(): void;
}

interface TaskSessionHostFactoryOptions {
	sessionId: string;
	bridgeEpoch: number;
	entries: readonly TaskBranchEntry[];
	persistEntries(
		entries: readonly TaskBranchEntry[],
		context: unknown,
	): void | Promise<void>;
}

type TaskSessionHostFactory = (
	options: TaskSessionHostFactoryOptions,
) => Promise<TaskSessionHost>;

export interface AgentTaskRuntimeCoordinatorOptions {
	sessionId: string;
	agent: OriginOSAgent;
	initialState?: AgentTaskRuntimePersistenceV1;
	persist(state: AgentTaskRuntimePersistenceV1): void | Promise<void>;
	onState?(snapshot: AgentTaskRuntimeSnapshotV1): void;
	hasPendingUserMessage?(): boolean;
	hasBudgetRemaining?(): boolean;
	hostFactory?: TaskSessionHostFactory;
	maxContinuations?: number;
	maxNoProgressTurns?: number;
}

export class AgentTaskRuntimeConflictError extends Error {
	readonly code = "TASK_RUNTIME_CONFLICT";
}

export class AgentTaskRuntimeProtocolError extends Error {
	readonly code = "TASK_RUNTIME_PROTOCOL_ERROR";
}

function toTaskBranchEntries(entries: readonly unknown[]): TaskBranchEntry[] {
	return entries.filter((entry): entry is TaskBranchEntry => {
		return entry !== null && typeof entry === "object"
			&& typeof (entry as { id?: unknown }).id === "string";
	});
}

async function defaultHostFactory(
	options: TaskSessionHostFactoryOptions,
): Promise<TaskSessionHost> {
	const module = await import("@originos/pi-agent-adapter/task-runtime") as unknown as {
		createPiTaskSessionHost(input: TaskSessionHostFactoryOptions): Promise<TaskSessionHost>;
	};
	return module.createPiTaskSessionHost(options);
}

function internalUserMessage(text: string): AgentMessage {
	return {
		role: "user",
		content: [{ type: "text", text }],
	} as unknown as AgentMessage;
}

function visibleUserMessage(text: string): AgentMessage {
	return {
		role: "user",
		content: [{ type: "text", text }],
	} as unknown as AgentMessage;
}

function taskStatusFromProjection(
	projection: AgentTaskProjectionV1,
): AgentTaskExecutionStateV1["status"] {
	switch (projection.status) {
		case "done":
			return "completed";
		case "cancelled":
			return "cancelled";
		case "blocked":
			return "waiting_user";
		default:
			return "running";
	}
}

function isActiveExecution(status: AgentTaskExecutionStateV1["status"]): boolean {
	return status === "planning" || status === "running" || status === "waiting_user" || status === "paused";
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export class AgentTaskRuntimeCoordinator {
	private readonly controller = new TaskContinuationController();
	private readonly hostFactory: TaskSessionHostFactory;
	private host: TaskSessionHost | null = null;
	private unsubscribeHost: (() => void) | null = null;
	private baselineTools: readonly AgentTool<unknown>[] = [];
	private taskToolsInstalled = false;
	private runningPromise: Promise<void> | null = null;
	private continuationGeneration = 0;
	private persistPromise = Promise.resolve();
	private state: AgentTaskRuntimePersistenceV1;

	constructor(private readonly options: AgentTaskRuntimeCoordinatorOptions) {
		this.hostFactory = options.hostFactory ?? defaultHostFactory;
		this.state = options.initialState ?? {
			schemaVersion: 1,
			execution: createIdleAgentTaskExecutionState(),
			branchEntries: [],
		};
	}

	async initialize(): Promise<AgentTaskRuntimeSnapshotV1> {
		if (this.host) {
			return this.getSnapshot();
		}
		const entries = toTaskBranchEntries(this.state.branchEntries);
		const bridgeEpoch = Math.max(1, this.state.execution.bridgeEpoch);
		this.host = await this.hostFactory({
			sessionId: this.options.sessionId,
			bridgeEpoch,
			entries,
			persistEntries: async (nextEntries) => {
				this.state = { ...this.state, branchEntries: [...nextEntries] };
				await this.queuePersist();
			},
		});
		this.unsubscribeHost = this.host.subscribeState((hostState) => {
			this.applyHostState(hostState);
		});
		const restored = await this.host.restore(entries);
		this.applyHostState(restored);
		if (isActiveExecution(this.state.execution.status)) {
			this.installTaskTools();
		}
		return this.getSnapshot();
	}

	getSnapshot(): AgentTaskRuntimeSnapshotV1 {
		return {
			version: AGENT_TASK_RUNTIME_PROTOCOL_VERSION,
			sessionId: this.options.sessionId,
			execution: structuredClone(this.state.execution),
			...(this.state.execution.projection
				? { projection: structuredClone(this.state.execution.projection) }
				: {}),
		};
	}

	getPersistenceState(): AgentTaskRuntimePersistenceV1 {
		return structuredClone(this.state);
	}

	async createTask(request: CreateAgentTaskRequestV1): Promise<AgentTaskRuntimeSnapshotV1> {
		await this.initialize();
		this.assertCreateRequest(request);
		const execution = this.state.execution;
		if (execution.requestId === request.requestId) {
			return this.getSnapshot();
		}
		if (execution.mode !== "chat" || isActiveExecution(execution.status)) {
			throw new AgentTaskRuntimeConflictError("当前 Session 已有进行中的正式任务");
		}

		this.state = {
			...this.state,
			execution: {
				...createIdleAgentTaskExecutionState(execution.bridgeEpoch),
				mode: "task_planning",
				status: "planning",
				requestId: request.requestId,
				draft: {
					...(request.title ? { title: request.title.trim() } : {}),
					objective: request.objective.trim(),
					...(request.context?.trim() ? { context: request.context.trim() } : {}),
					acceptanceCriteria: request.acceptanceCriteria?.map((item) => item.trim()).filter(Boolean) ?? [],
				},
				updatedAt: new Date().toISOString(),
			},
		};
		this.installTaskTools();
		await this.publishState();

		try {
			await this.options.agent.prompt(
				internalUserMessage(this.buildPlanningPrompt(request)),
				undefined,
				{ completionPolicy: "task_runtime", internalMessage: true },
			);
			const projection = projectPiTaskSnapshot(this.requireHost().getSnapshot());
			if (!projection) {
				throw new Error("模型结束 planning turn，但没有调用 task_plan 创建正式任务");
			}
			this.updateFromProjection(projection, "task_running");
			await this.publishState();
			this.startContinuationLoop();
			return this.getSnapshot();
		} catch (error) {
			this.fail("TASK_PLANNING_FAILED", errorMessage(error), true);
			this.restoreBaselineTools();
			await this.publishState();
			return this.getSnapshot();
		}
	}

	async controlTask(request: ControlAgentTaskRequestV1): Promise<AgentTaskRuntimeSnapshotV1> {
		await this.initialize();
		this.assertControlRequest(request);
		switch (request.action) {
			case "stop":
				await this.pauseTask();
				break;
			case "cancel":
				await this.cancelTask(request.requestId);
				break;
			case "resume":
				this.resumeTask();
				break;
			case "retry":
				await this.retryTask(request.requestId);
				break;
		}
		return this.getSnapshot();
	}

	async submitUserReply(content: string): Promise<AgentTaskRuntimeSnapshotV1> {
		await this.initialize();
		if (this.state.execution.mode !== "task_running" || this.state.execution.status !== "waiting_user") {
			throw new AgentTaskRuntimeConflictError("当前任务不处于等待用户输入状态");
		}
		if (!content.trim()) {
			throw new AgentTaskRuntimeProtocolError("任务答复不能为空");
		}
		const projection = this.state.execution.projection;
		const blocker = projection?.blockers.find((candidate) => !candidate.resolved);
		if (!projection || !blocker) {
			throw new AgentTaskRuntimeConflictError("当前任务没有可答复的未解决 blocker");
		}

		this.installTaskTools();
		this.state.execution.status = "running";
		this.state.execution.lastError = undefined;
		this.state.execution.updatedAt = new Date().toISOString();
		await this.publishState();

		const context = internalUserMessage([
			"[Internal Task Runtime] 用户正在答复当前任务 blocker。",
			`taskId: ${projection.taskId}`,
			`blockerId: ${blocker.id}`,
			`expectedRevision: ${projection.revision}`,
			`bridgeEpoch: ${this.state.execution.bridgeEpoch}`,
			"先用 task_update 记录并解决该 blocker，再继续当前步骤；不要创建新任务。",
		].join("\n"));
		const baseline = createAgentTaskProgressFingerprint(projection);
		try {
			await this.options.agent.prompt(
				[context, visibleUserMessage(content.trim())],
				undefined,
				{ completionPolicy: "task_runtime", internalMessageIndexes: [0] },
			);
			const nextProjection = projectPiTaskSnapshot(this.requireHost().getSnapshot());
			if (!nextProjection) {
				throw new Error("Task 用户答复后 canonical Task 丢失");
			}
			this.updateFromProjection(
				nextProjection,
				nextProjection.status === "done" || nextProjection.status === "cancelled"
					? "chat"
					: "task_running",
				baseline,
			);
			await this.publishState();
			if (this.state.execution.status === "running") {
				this.startContinuationLoop();
			}
		} catch (error) {
			const currentStatus: AgentTaskExecutionStateV1["status"] = this.getSnapshot().execution.status;
			if (currentStatus === "paused" || currentStatus === "cancelled") {
				return this.getSnapshot();
			}
			this.fail("TASK_USER_REPLY_FAILED", errorMessage(error), true, true);
			await this.publishState();
		}
		return this.getSnapshot();
	}

	async resumeAfterRestore(): Promise<AgentTaskRuntimeSnapshotV1> {
		await this.initialize();
		if (this.state.execution.mode === "task_running" && this.state.execution.status === "running") {
			this.startContinuationLoop();
		}
		return this.getSnapshot();
	}

	destroy(): void {
		this.options.agent.abort();
		this.unsubscribeHost?.();
		this.unsubscribeHost = null;
		this.host?.invalidate();
		this.host = null;
		this.restoreBaselineTools();
	}

	private applyHostState(hostState: TaskHostState): void {
		const projection = projectPiTaskSnapshot({
			...hostState.snapshot,
			scope: hostState.scope,
		});
		if (!projection) {
			return;
		}
		const preservedStatus = this.state.execution.status;
		const preservedError = this.state.execution.lastError;
		this.updateFromProjection(
			projection,
			projection.status === "done" || projection.status === "cancelled"
				? "chat"
				: "task_running",
		);
		if (
			projection.status !== "done"
			&& projection.status !== "cancelled"
			&& (preservedStatus === "paused" || preservedStatus === "failed")
		) {
			this.state.execution.status = preservedStatus;
			this.state.execution.lastError = preservedError;
		}
		void this.publishState();
	}

	private updateFromProjection(
		projection: AgentTaskProjectionV1,
		mode: AgentTaskExecutionStateV1["mode"],
		fullTurnBaseline?: string,
	): void {
		const previous = this.state.execution;
		const fingerprint = createAgentTaskProgressFingerprint(projection);
		const progressed = (fullTurnBaseline ?? previous.lastProgressFingerprint) !== fingerprint;
		this.state = {
			...this.state,
			execution: {
				...previous,
				mode,
				status: taskStatusFromProjection(projection),
				taskId: projection.taskId,
				expectedRevision: projection.revision,
				expectedCursor: projection.cursor,
				projection,
				lastProgressFingerprint: fingerprint,
				noProgressCount: progressed
					? 0
					: fullTurnBaseline !== undefined
						? previous.noProgressCount + 1
						: previous.noProgressCount,
				lastError: undefined,
				updatedAt: new Date().toISOString(),
			},
		};
		if (mode === "chat") {
			this.restoreBaselineTools();
		}
	}

	private installTaskTools(): void {
		if (this.taskToolsInstalled) {
			return;
		}
		const host = this.requireHost();
		this.baselineTools = this.options.agent.getTools();
		const taskTools = host.getAgentTools().map((tool) => ({
			name: tool.name,
			label: tool.label,
			description: tool.description,
			parameters: tool.parameters,
			execute: tool.execute,
		})) as AgentTool<unknown>[];
		const taskToolNames = new Set(taskTools.map((tool) => tool.name));
		this.options.agent.setTools([
			...this.baselineTools.filter((tool) => !taskToolNames.has(tool.name)),
			...taskTools,
		]);
		this.taskToolsInstalled = true;
	}

	private restoreBaselineTools(): void {
		if (!this.taskToolsInstalled) {
			return;
		}
		this.options.agent.setTools([...this.baselineTools]);
		this.taskToolsInstalled = false;
	}

	private startContinuationLoop(): void {
		if (this.runningPromise) {
			return;
		}
		const generation = ++this.continuationGeneration;
		let runningPromise: Promise<void>;
		runningPromise = this.runContinuationLoop(generation)
			.catch(async (error: unknown) => {
				if (generation !== this.continuationGeneration) {
					return;
				}
				this.fail("TASK_CONTINUATION_FAILED", errorMessage(error), true, true);
				await this.publishState();
			})
			.finally(() => {
				if (this.runningPromise === runningPromise) {
					this.runningPromise = null;
				}
			});
		this.runningPromise = runningPromise;
	}

	private async runContinuationLoop(generation: number): Promise<void> {
		while (this.state.execution.mode === "task_running" && this.state.execution.status === "running") {
			await this.options.agent.waitForIdle();
			if (generation !== this.continuationGeneration) {
				return;
			}
			const decision = this.controller.decide({
				execution: this.state.execution,
				projection: this.state.execution.projection,
				agentIdle: true,
				hasPendingUserMessage: this.options.hasPendingUserMessage?.() ?? false,
				budgetRemaining: this.options.hasBudgetRemaining?.() ?? true,
				currentBridgeEpoch: this.requireHost().getScope().bridgeEpoch,
				maxContinuations: this.options.maxContinuations,
				maxNoProgressTurns: this.options.maxNoProgressTurns,
			});
			if (decision.type !== "continue") {
				await this.applyContinuationDecision(decision);
				return;
			}

			this.state = {
				...this.state,
				execution: {
					...this.state.execution,
					continuationCount: this.state.execution.continuationCount + 1,
					updatedAt: new Date().toISOString(),
				},
			};
			await this.publishState();
			await this.options.agent.prompt(
				internalUserMessage(this.buildContinuationPrompt()),
				undefined,
				{ completionPolicy: "task_runtime", internalMessage: true },
			);
			if (generation !== this.continuationGeneration) {
				return;
			}

			const projection = projectPiTaskSnapshot(this.requireHost().getSnapshot());
			if (!projection) {
				throw new Error("Task continuation 后 canonical Task 丢失");
			}
			this.updateFromProjection(
				projection,
				projection.status === "done" ? "chat" : "task_running",
				decision.fingerprint,
			);
			await this.publishState();
		}
	}

	private async applyContinuationDecision(
		decision: Exclude<AgentTaskContinuationDecision, { type: "continue" }>,
	): Promise<void> {
		if (decision.type === "complete") {
			this.state.execution.mode = "chat";
			this.state.execution.status = "completed";
			this.restoreBaselineTools();
		} else if (decision.type === "wait_user") {
			this.state.execution.status = "waiting_user";
		} else if (decision.type === "pause") {
			this.state.execution.status = "paused";
			this.state.execution.lastError = {
				code: "TASK_PAUSED",
				message: decision.reason,
				retryable: true,
			};
		} else if (decision.type === "fail") {
			this.fail("TASK_RUNTIME_SCOPE_FAILED", decision.reason, false, true);
		}
		this.state.execution.updatedAt = new Date().toISOString();
		await this.publishState();
	}

	private async pauseTask(): Promise<void> {
		if (this.state.execution.mode !== "task_running" || !isActiveExecution(this.state.execution.status)) {
			throw new AgentTaskRuntimeConflictError("只有活动任务可以停止");
		}
		this.continuationGeneration += 1;
		this.runningPromise = null;
		this.options.agent.abort();
		this.state.execution.status = "paused";
		this.state.execution.lastError = {
			code: "TASK_PAUSED_BY_USER",
			message: "用户停止了当前任务执行，进度已保留",
			retryable: true,
		};
		this.state.execution.updatedAt = new Date().toISOString();
		this.restoreBaselineTools();
		await this.publishState();
	}

	private async cancelTask(requestId: string): Promise<void> {
		this.continuationGeneration += 1;
		this.runningPromise = null;
		this.options.agent.abort();
		const projection = this.state.execution.projection;
		if (projection && projection.status !== "done" && projection.status !== "cancelled") {
			const scope = this.requireHost().getScope();
			await this.requireHost().invoke({
				version: 1,
				requestId,
				toolName: "task_update",
				scope: {
					sessionId: this.options.sessionId,
					expectedCursor: scope.cursor,
					expectedRevision: scope.revision,
					bridgeEpoch: scope.bridgeEpoch,
				},
				input: {
					task_id: projection.taskId,
					status: "cancelled",
					reason: "用户取消任务",
					activity: "用户从 Task 卡片取消任务",
				},
			});
		}
		this.state.execution.mode = "chat";
		this.state.execution.status = "cancelled";
		this.state.execution.updatedAt = new Date().toISOString();
		this.restoreBaselineTools();
		await this.publishState();
	}

	private resumeTask(): void {
		if (this.state.execution.status !== "paused" && this.state.execution.status !== "waiting_user") {
			throw new AgentTaskRuntimeConflictError("只有暂停或等待用户的任务可以恢复");
		}
		this.state.execution.mode = "task_running";
		this.state.execution.status = "running";
		this.state.execution.lastError = undefined;
		this.state.execution.updatedAt = new Date().toISOString();
		this.installTaskTools();
		void this.publishState();
		this.startContinuationLoop();
	}

	private async retryTask(requestId: string): Promise<void> {
		const draft = this.state.execution.draft;
		if (this.state.execution.status !== "failed") {
			throw new AgentTaskRuntimeConflictError("只有失败的任务可以重试");
		}
		if (this.state.execution.projection) {
			this.state.execution.mode = "task_running";
			this.state.execution.status = "running";
			this.state.execution.lastError = undefined;
			this.state.execution.updatedAt = new Date().toISOString();
			this.installTaskTools();
			await this.publishState();
			this.startContinuationLoop();
			return;
		}
		if (!draft) {
			throw new AgentTaskRuntimeConflictError("失败任务没有可重试的草稿或 canonical state");
		}
		await this.createTask({
			version: 1,
			requestId,
			sessionId: this.options.sessionId,
			objective: draft.objective,
			title: draft.title,
			context: draft.context,
			acceptanceCriteria: draft.acceptanceCriteria,
		});
	}

	private buildPlanningPrompt(request: CreateAgentTaskRequestV1): string {
		const criteria = request.acceptanceCriteria?.filter((item) => item.trim()) ?? [];
		return [
			"[Internal Task Runtime] 用户已确认创建正式任务。",
			"必须先调用 task_plan 且只调用一次；不要只返回计划性文本。",
			`任务标题：${request.title?.trim() || "请根据目标生成简洁标题"}`,
			`任务目标：${request.objective.trim()}`,
			request.context?.trim()
				? `用户补充上下文：\n${request.context.trim()}`
				: "用户未提供额外上下文，请使用当前 Session 已有上下文。",
			criteria.length > 0
				? `用户验收标准：\n${criteria.map((item, index) => `${index + 1}. ${item}`).join("\n")}`
				: "请生成具体、可验证且需要证据的验收标准。",
			"plan_steps 必须按依赖顺序排列；每步只包含一个可观察输出和一种验证方式。",
			"此任务只在当前 Session 执行，不要创建 Workflow、subagent、worker、DAG 或新 Session。",
		].join("\n\n");
	}

	private buildContinuationPrompt(): string {
		return [
			"[Internal Task Runtime] 继续当前 canonical pi-tasks 任务。",
			"先调用 task_focus 或 task_next 获取唯一当前步骤，只执行该步骤。",
			"完成可验证工作后先用 task_evidence 记录可复现证据，再用 task_update 更新步骤。",
			"只有全部步骤和验收标准具备有效证据且无 blocker 时才能调用 task_complete。",
			"若确实需要用户或外部条件，记录 blocker 并清楚说明所需输入；不要仅承诺稍后继续。",
		].join("\n\n");
	}

	private assertCreateRequest(request: CreateAgentTaskRequestV1): void {
		if (request.version !== AGENT_TASK_RUNTIME_PROTOCOL_VERSION) {
			throw new AgentTaskRuntimeProtocolError("不支持的 Task Runtime protocol version");
		}
		if (request.sessionId !== this.options.sessionId) {
			throw new AgentTaskRuntimeProtocolError("Task 请求 Session 不匹配");
		}
		if (!request.requestId.trim() || !request.objective.trim()) {
			throw new AgentTaskRuntimeProtocolError("Task requestId 和 objective 不能为空");
		}
	}

	private assertControlRequest(request: ControlAgentTaskRequestV1): void {
		if (request.version !== AGENT_TASK_RUNTIME_PROTOCOL_VERSION || request.sessionId !== this.options.sessionId) {
			throw new AgentTaskRuntimeProtocolError("Task control 协议或 Session 不匹配");
		}
		const execution = this.state.execution;
		if (
			request.expectedRevision !== execution.expectedRevision
			|| request.expectedCursor !== execution.expectedCursor
			|| request.bridgeEpoch !== execution.bridgeEpoch
		) {
			throw new AgentTaskRuntimeConflictError("Task control scope 已过期，请刷新状态后重试");
		}
	}

	private fail(code: string, message: string, retryable: boolean, retainTaskLease = false): void {
		this.state.execution = {
			...this.state.execution,
			mode: retainTaskLease && this.state.execution.projection ? "task_running" : "chat",
			status: "failed",
			lastError: { code, message, retryable },
			updatedAt: new Date().toISOString(),
		};
	}

	private requireHost(): TaskSessionHost {
		if (!this.host) {
			throw new Error("Task Session host 尚未初始化");
		}
		return this.host;
	}

	private async publishState(): Promise<void> {
		await this.queuePersist();
		this.options.onState?.(this.getSnapshot());
	}

	private queuePersist(): Promise<void> {
		const snapshot = structuredClone(this.state);
		this.persistPromise = this.persistPromise
			.catch(() => undefined)
			.then(() => this.options.persist(snapshot));
		return this.persistPromise;
	}
}
