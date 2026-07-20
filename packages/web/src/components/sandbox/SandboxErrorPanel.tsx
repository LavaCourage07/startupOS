'use client';

import useSandboxStore from '@/store/sandboxStore';

export function SandboxErrorPanel() {
  const runtime = useSandboxStore((s) => (s.activeAppId ? s.runtime[s.activeAppId] : null));

  if (!runtime || runtime.errors.length === 0) return null;

  return (
    <div className="border-t border-red-200 bg-red-50 px-3 py-2 font-mono text-xs max-h-40 overflow-auto">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-red-600 font-semibold">错误 ({runtime.errors.length})</span>
      </div>
      {runtime.errors.map((err, i) => (
        <div key={i} className="mb-2 text-red-700">
          <div className="font-medium">{err.message}</div>
          {err.lineno != null && (
            <span className="text-red-500">行 {err.lineno}</span>
          )}
          {err.stack && (
            <pre className="mt-1 text-red-600 whitespace-pre-wrap break-all opacity-70">
              {err.stack}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

export default SandboxErrorPanel;
