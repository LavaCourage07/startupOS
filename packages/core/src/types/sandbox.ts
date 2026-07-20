/**
 * 沙盒执行相关数据类型定义
 */

/**
 * 业务场景
 */
export interface BusinessScenario {
	/**
	 * 场景 ID
	 */
	id: string;

	/**
	 * 场景名称
	 */
	name: string;

	/**
	 * 场景描述
	 */
	description: string;

	/**
	 * 触发条件
	 */
	triggerCondition: string;

	/**
	 * 预期结果
	 */
	expectedResult: string;

	/**
	 * 场景类型
	 */
	type: 'normal' | 'exception' | 'boundary';
}

/**
 * Agent 推演步骤
 */
export interface SimulationStep {
	/**
	 * 步骤序号
	 */
	stepNumber: number;

	/**
	 * Agent ID
	 */
	agentId: string;

	/**
	 * Agent 名称
	 */
	agentName: string;

	/**
	 * 操作描述
	 */
	action: string;

	/**
	 * 输入数据
	 */
	input: Record<string, unknown>;

	/**
	 * 输出数据
	 */
	output: Record<string, unknown>;

	/**
	 * 执行时间（毫秒）
	 */
	duration: number;

	/**
	 * 状态
	 */
	status: 'success' | 'error' | 'skipped';

	/**
	 * 错误信息（如果有）
	 */
	error?: string;
}

/**
 * 推演报告
 */
export interface SimulationReport {
	/**
	 * 场景 ID
	 */
	scenarioId: string;

	/**
	 * 场景名称
	 */
	scenarioName: string;

	/**
	 * 推演步骤
	 */
	steps: SimulationStep[];

	/**
	 * 总执行时间（毫秒）
	 */
	totalDuration: number;

	/**
	 * 推演结果
	 */
	result: 'success' | 'partial' | 'failed';

	/**
	 * 结果摘要
	 */
	summary: string;

	/**
	 * 执行时间
	 */
	executedAt: number;
}

/**
 * 本体缺口
 */
export interface OntologyGap {
	/**
	 * 缺口 ID
	 */
	id: string;

	/**
	 * 缺口类型
	 */
	type: 'missing_object' | 'missing_field' | 'missing_relation';

	/**
	 * 相关 Agent ID
	 */
	agentId: string;

	/**
	 * 相关 Agent 名称
	 */
	agentName: string;

	/**
	 * 缺口描述
	 */
	description: string;

	/**
	 * 建议的修复方案
	 */
	suggestion: string;

	/**
	 * 严重程度
	 */
	severity: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * 本体缺口报告
 */
export interface OntologyGapReport {
	/**
	 * 场景 ID
	 */
	scenarioId: string;

	/**
	 * 缺口列表
	 */
	gaps: OntologyGap[];

	/**
	 * 是否有缺口
	 */
	hasGaps: boolean;

	/**
	 * 缺口总数
	 */
	totalGaps: number;

	/**
	 * 关键缺口数量
	 */
	criticalGaps: number;

	/**
	 * 生成时间
	 */
	generatedAt: number;
}

/**
 * 沙盒执行结果
 */
export interface SandboxExecutionResult {
	/**
	 * 执行 ID
	 */
	executionId: string;

	/**
	 * 方案 ID
	 */
	solutionId: string;

	/**
	 * 场景 ID
	 */
	scenarioId: string;

	/**
	 * 推演报告
	 */
	simulationReport: SimulationReport;

	/**
	 * 本体缺口报告
	 */
	ontologyGapReport: OntologyGapReport;

	/**
	 * 执行时间
	 */
	executedAt: number;
}

/**
 * 沙盒执行请求
 */
export interface SandboxExecutionRequest {
	/**
	 * 方案 ID
	 */
	solutionId: string;

	/**
	 * 场景 ID
	 */
	scenarioId: string;
}

/**
 * 生成场景请求
 */
export interface GenerateScenariosRequest {
	/**
	 * 方案 ID
	 */
	solutionId: string;

	/**
	 * 场景数量（可选，默认 3-5 个）
	 */
	count?: number;
}

// ============================================================
// 代码沙箱（前端应用运行）
// ============================================================

/**
 * 沙箱应用：一个包含 index.html 的静态前端应用
 */
export interface SandboxApp {
  id: string;           // 应用目录名，如 'my-dashboard'
  name: string;         // 应用名称
  path: string;         // 在 data 下的相对路径
  updatedAt: number;    // 最后更新时间
}

/**
 * 控制台日志
 */
export interface SandboxLog {
  id: string;
  type: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: string[];
  timestamp: number;
}

/**
 * 运行时错误
 */
export interface SandboxErrorInfo {
  message: string;
  stack?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
}

/**
 * 沙箱运行时状态
 */
export interface SandboxRuntimeState {
  appId: string;
  status: 'idle' | 'loading' | 'running' | 'error';
  logs: SandboxLog[];
  errors: SandboxErrorInfo[];
}

/**
 * 沙箱 Store 状态
 */
export interface SandboxStoreState {
  apps: SandboxApp[];
  activeAppId: string | null;
  runtime: Record<string, SandboxRuntimeState>;
  isConsoleOpen: boolean;
  consoleFilter: 'all' | 'log' | 'warn' | 'error';

  loadApps: () => Promise<void>;
  setActiveApp: (appId: string | null) => void;
  addLog: (appId: string, log: SandboxLog) => void;
  addError: (appId: string, error: SandboxErrorInfo) => void;
  clearConsole: (appId: string) => void;
  toggleConsole: () => void;
  setConsoleFilter: (filter: 'all' | 'log' | 'warn' | 'error') => void;
}
