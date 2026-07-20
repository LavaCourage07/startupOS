'use client';

import { useEffect, useCallback, useState } from 'react';
import useSandboxStore from '@/store/sandboxStore';
import { SandboxIframe } from './SandboxIframe';
import { SandboxConsole } from './SandboxConsole';
import { SandboxErrorPanel } from './SandboxErrorPanel';


export function SandboxWindow({ initialAppId }: { initialAppId?: string }) {
  const apps = useSandboxStore((s) => s.apps);
  const activeAppId = useSandboxStore((s) => s.activeAppId);
  const loadApps = useSandboxStore((s) => s.loadApps);
  const setActiveApp = useSandboxStore((s) => s.setActiveApp);
  const isConsoleOpen = useSandboxStore((s) => s.isConsoleOpen);
  const toggleConsole = useSandboxStore((s) => s.toggleConsole);
  const [showList, setShowList] = useState(!initialAppId);

  useEffect(() => {
    loadApps().then(() => {
      if (initialAppId) {
        setActiveApp(initialAppId);
        setShowList(false);
      }
    });
  }, [loadApps, initialAppId, setActiveApp]);

  const handleSelectApp = useCallback(
    (appId: string) => {
      setActiveApp(appId);
      setShowList(false);
    },
    [setActiveApp],
  );

  const handleBack = useCallback(() => {
    setActiveApp(null);
    setShowList(true);
  }, [setActiveApp]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          {!showList && activeAppId && (
            <button
              onClick={handleBack}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              ← 返回
            </button>
          )}
          <span className="font-medium text-gray-900">
            {showList ? '代码沙箱' : activeAppId}
          </span>
        </div>

        {!showList && activeAppId && (
          <div className="flex items-center gap-2">
            <button
              onClick={toggleConsole}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                isConsoleOpen
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-200'
              }`}
            >
              控制台
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {showList ? (
          /* App List */
          <div className="flex-1 overflow-auto p-4">
            {apps.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                <p className="text-lg mb-2">暂无沙箱应用</p>
                <p className="text-sm">
                  使用 skill 或 agent 构建前端应用后将在此处显示
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {apps.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => handleSelectApp(app.id)}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    <span className="text-3xl">🔬</span>
                    <span className="text-sm font-medium text-gray-800">{app.name}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(app.updatedAt).toLocaleDateString('zh-CN')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : activeAppId ? (
          /* Sandbox Preview */
          <div className="flex-1 flex flex-col overflow-hidden">
            <SandboxIframe appId={activeAppId} />
            {isConsoleOpen && (
              <div className="h-48 border-t border-gray-200">
                <SandboxConsole />
              </div>
            )}
            <SandboxErrorPanel />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default SandboxWindow;
