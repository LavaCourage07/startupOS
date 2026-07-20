'use client';

import useSandboxStore from '@/store/sandboxStore';

const LEVEL_COLORS: Record<string, string> = {
  log: 'text-gray-700',
  info: 'text-blue-500',
  warn: 'text-yellow-500',
  error: 'text-red-500',
  debug: 'text-purple-500',
};

const LEVEL_ICONS: Record<string, string> = {
  log: '>',
  info: 'i',
  warn: '!',
  error: 'x',
  debug: '?',
};

export function SandboxConsole() {
  const runtime = useSandboxStore((s) => (s.activeAppId ? s.runtime[s.activeAppId] : null));
  const filter = useSandboxStore((s) => s.consoleFilter);
  const clearConsole = useSandboxStore((s) => s.clearConsole);
  const setFilter = useSandboxStore((s) => s.setConsoleFilter);
  const isConsoleOpen = useSandboxStore((s) => s.isConsoleOpen);
  const toggleConsole = useSandboxStore((s) => s.toggleConsole);

  if (!runtime || !isConsoleOpen) return null;

  const filteredLogs =
    filter === 'all'
      ? runtime.logs
      : runtime.logs.filter((l) => l.type === filter);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">控制台</span>
          <span className="text-gray-400">({filteredLogs.length})</span>
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'log', 'warn', 'error'] as const).map((level) => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                filter === level
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {level === 'all' ? '全部' : level}
            </button>
          ))}
          <button
            onClick={() => clearConsole(runtime.appId)}
            className="ml-2 px-2 py-0.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-xs"
          >
            清空
          </button>
          <button
            onClick={toggleConsole}
            className="ml-1 px-2 py-0.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-xs"
            title="关闭控制台"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-auto p-2 space-y-0.5">
        {filteredLogs.length === 0 ? (
          <div className="text-gray-500 text-center py-4">暂无日志输出</div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className={`flex gap-2 ${LEVEL_COLORS[log.type]}`}>
              <span className="text-gray-500 select-none w-5 text-right">
                {LEVEL_ICONS[log.type]}
              </span>
              <span className="break-all">
                {log.args.join(' ')}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default SandboxConsole;
