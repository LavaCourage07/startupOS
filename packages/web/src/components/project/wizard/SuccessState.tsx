/**
 * Story C.5: Success State Component
 */

'use client';

interface SuccessStateProps {
  project: {
    id: string;
    name: string;
    path: string;
  };
  onEnter: () => void;
  onLater: () => void;
}

export function SuccessState({ project, onEnter, onLater }: SuccessStateProps) {
  return (
    <div className="flex flex-col items-center py-8 space-y-6">
      {/* Success Icon */}
      <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {/* Text */}
      <div className="text-center">
        <h3 className="text-xl font-semibold text-white mb-2">
          项目创建成功！
        </h3>
        <p className="text-gray-400">
          项目 "{project.name}" 已创建成功！
        </p>
      </div>

      {/* Project Info */}
      <div className="w-full max-w-sm px-4 py-3 bg-white/5 border border-white/10 rounded-lg">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">项目路径</span>
            <span className="text-white font-mono">{project.path}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">配置文件</span>
            <span className="text-green-400">已生成</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">智能辅助</span>
            <span className="text-green-400">已配置</span>
          </div>
        </div>
      </div>

      {/* Tip */}
      <p className="text-sm text-gray-500">
        💡 你可以随时在项目设置中调整这些配置
      </p>

      {/* Actions */}
      <div className="flex items-center gap-4 pt-4">
        <button
          onClick={onLater}
          className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
        >
          稍后设置
        </button>
        <button
          onClick={onEnter}
          className="px-6 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg transition-colors"
        >
          进入项目
        </button>
      </div>
    </div>
  );
}
