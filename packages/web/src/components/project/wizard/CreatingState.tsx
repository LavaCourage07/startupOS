/**
 * Story C.5: Creating State Component
 */

'use client';

export function CreatingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      {/* Spinner */}
      <div className="relative">
        <div className="w-16 h-16 border-4 border-primary/20 rounded-full" />
        <div className="absolute top-0 left-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>

      {/* Text */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-2">
          创建项目中...
        </h3>
        <p className="text-sm text-gray-400">
          这可能需要几秒钟
        </p>
      </div>

      {/* Progress Items */}
      <div className="w-full max-w-sm space-y-2">
        <ProgressItem text="项目文件夹创建完成" done />
        <ProgressItem text="初始配置已生成" done />
        <ProgressItem text="智能辅助配置中..." active />
        <ProgressItem text="项目看板准备中..." />
      </div>
    </div>
  );
}

function ProgressItem({ text, done, active }: { text: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center ${
          done
            ? 'bg-green-500'
            : active
            ? 'bg-primary/20 border-2 border-primary'
            : 'bg-gray-700'
        }`}
      >
        {done && (
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {active && (
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
        )}
      </div>
      <span className={`text-sm ${done ? 'text-white' : active ? 'text-primary' : 'text-gray-500'}`}>
        {text}
      </span>
    </div>
  );
}
