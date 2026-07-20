/**
 * 错误处理模块
 * 定义 OriginOS Agent 的错误类型和处理逻辑
 */

/**
 * 错误类型枚举
 */
export enum ErrorType {
	NETWORK_ERROR = 'NETWORK_ERROR',
	TOOL_ERROR = 'TOOL_ERROR',
	LLM_ERROR = 'LLM_ERROR',
	VALIDATION_ERROR = 'VALIDATION_ERROR',
	TIMEOUT_ERROR = 'TIMEOUT_ERROR',
	UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
	LOW = 'LOW',
	MEDIUM = 'MEDIUM',
	HIGH = 'HIGH',
	CRITICAL = 'CRITICAL',
}

/**
 * Pi Agent 错误接口
 */
export interface PiAgentError {
	type: ErrorType;
	severity: ErrorSeverity;
	message: string;
	details?: unknown;
	recoverable: boolean;
	timestamp: number;
	/**
	 * 推荐的恢复操作
	 */
	recovery?: {
		type: 'retry' | 'continue' | 'abort' | 'manual';
		label: string;
		description?: string;
	};
}

/**
 * 错误上下文
 */
export interface ErrorContext {
	operation?: string;
	sessionId?: string;
	toolName?: string;
	 requestId?: string;
}

/**
 * 获取错误类型
 */
export function getErrorType(error: unknown): ErrorType {
	if (!error) {
		return ErrorType.UNKNOWN_ERROR;
	}

	if (error instanceof Error) {
		const message = error.message.toLowerCase();

		if (message.includes('network') || message.includes('fetch')) {
			return ErrorType.NETWORK_ERROR;
		}
		if (message.includes('timeout')) {
			return ErrorType.TIMEOUT_ERROR;
		}
		if (message.includes('validation')) {
			return ErrorType.VALIDATION_ERROR;
		}
		if (message.includes('tool')) {
			return ErrorType.TOOL_ERROR;
		}
	}

	return ErrorType.LLM_ERROR;
}

/**
 * 获取错误严重级别
 */
export function getErrorSeverity(errorType: ErrorType): ErrorSeverity {
	switch (errorType) {
		case ErrorType.NETWORK_ERROR:
		case ErrorType.TIMEOUT_ERROR:
			return ErrorSeverity.MEDIUM;
		case ErrorType.TOOL_ERROR:
			return ErrorSeverity.LOW;
		case ErrorType.VALIDATION_ERROR:
			return ErrorSeverity.LOW;
		case ErrorType.LLM_ERROR:
			return ErrorSeverity.HIGH;
		default:
			return ErrorSeverity.MEDIUM;
	}
}

/**
 * 创建 Pi Agent 错误
 */
export function createPiAgentError(
	error: unknown,
	context?: ErrorContext
): PiAgentError {
	const errorType = getErrorType(error);
	const severity = getErrorSeverity(errorType);
	const errorMessage = error instanceof Error ? error.message : String(error);

	const piError: PiAgentError = {
		type: errorType,
		severity,
		message: getErrorMessage(errorType, errorMessage),
		details: error,
		recoverable: isRecoverable(errorType),
		timestamp: Date.now(),
	};

	// 添加恢复建议
	if (piError.recoverable) {
		piError.recovery = getRecoveryAction(errorType, context);
	}

	return piError;
}

/**
 * 获取友好的错误消息
 */
export function getErrorMessage(errorType: ErrorType, originalMessage: string): string {
	switch (errorType) {
		case ErrorType.NETWORK_ERROR:
			return '网络连接错误，请检查您的网络连接';
		case ErrorType.TIMEOUT_ERROR:
			return '请求超时，请稍后重试';
		case ErrorType.TOOL_ERROR:
			return `工具执行失败：${originalMessage}`;
		case ErrorType.VALIDATION_ERROR:
			return `请求数据无效：${originalMessage}`;
		case ErrorType.LLM_ERROR:
			return '服务器错误，请稍后重试';
		default:
			return originalMessage || '未知错误';
	}
}

/**
 * 判断是否可恢复
 */
export function isRecoverable(errorType: ErrorType): boolean {
	switch (errorType) {
		case ErrorType.NETWORK_ERROR:
		case ErrorType.TIMEOUT_ERROR:
		case ErrorType.TOOL_ERROR:
			return true;
		case ErrorType.VALIDATION_ERROR:
		case ErrorType.LLM_ERROR:
			return false;
		default:
			return false;
	}
}

/**
 * 获取恢复操作建议
 */
function getRecoveryAction(
	errorType: ErrorType,
	context?: ErrorContext
): {
	type: 'retry' | 'continue' | 'abort' | 'manual';
	label: string;
	description?: string;
} {
	switch (errorType) {
		case ErrorType.NETWORK_ERROR:
			return {
				type: 'retry',
				label: '重试',
				description: '重新发送请求',
			};
		case ErrorType.TIMEOUT_ERROR:
			return {
				type: 'retry',
				label: '重试',
				description: '重新发送请求',
			};
		case ErrorType.TOOL_ERROR:
			if (context?.toolName) {
				return {
					type: 'abort',
					label: '继续对话',
					description: '您可以尝试换个方式表达需求',
				};
			}
			return {
				type: 'continue',
				label: '继续',
			};
		default:
			return {
				type: 'manual',
				label: '查看详情',
			};
	}
}

/**
 * 错误处理器类
 */
export class ErrorHandler {
	private errors: PiAgentError[] = [];

	/**
	 * 处理错误
	 */
	handleError(error: unknown, context?: ErrorContext): PiAgentError {
		const piError = createPiAgentError(error, context);
		this.errors.push(piError);
		return piError;
	}

	/**
	 * 获取最近的错误
	 */
	getLastError(): PiAgentError | null {
		return this.errors[this.errors.length - 1] ?? null;
	}

	/**
	 * 清除错误历史
	 */
	clearErrors(): void {
		this.errors = [];
	}

	/**
	 * 获取所有错误
	 */
	getAllErrors(): PiAgentError[] {
		return [...this.errors];
	}
}

// 导出单例实例
export const errorHandler = new ErrorHandler();
