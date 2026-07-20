/**
 * OS.8: Error Reporting
 */

export interface ErrorReport {
  message: string;
  stack?: string;
  timestamp: number;
  userAgent: string;
}

export function reportError(error: Error): void {
  const report: ErrorReport = {
    message: error.message,
    stack: error.stack,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
  };

  console.error('Error Report:', report);
  // 可以在这里添加发送到错误追踪服务的逻辑
}
