'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import useSandboxStore from '@/store/sandboxStore';
import type { SandboxLog, SandboxErrorInfo } from '@originos/core/types';

interface SandboxIframeProps {
  appId: string;
  onLoad?: () => void;
  onError?: (error: string) => void;
}

export function SandboxIframe({
  appId,
  onLoad,
  onError,
}: SandboxIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addLog = useSandboxStore((s) => s.addLog);
  const addError = useSandboxStore((s) => s.addError);

  // Listen for postMessage from iframe
  const handleMessage = useCallback(
    (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;

      if (e.data.type === 'sandbox-console') {
        const log: SandboxLog = {
          id: `${appId}-${Date.now()}-${Math.random()}`,
          type: e.data.method,
          args: e.data.args,
          timestamp: e.data.timestamp,
        };
        addLog(appId, log);
      }

      if (e.data.type === 'sandbox-error') {
        const err: SandboxErrorInfo = {
          message: e.data.message,
          stack: e.data.stack,
          lineno: e.data.lineno,
          colno: e.data.colno,
          timestamp: e.data.timestamp,
        };
        addError(appId, err);
      }
    },
    [appId, addLog, addError],
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Reset state when appId changes
  useEffect(() => {
    setLoading(true);
    setError(null);
  }, [appId]);

  const handleIframeLoad = useCallback(() => {
    setLoading(false);
    onLoad?.();
  }, [onLoad]);

  const handleIframeError = useCallback(() => {
    setLoading(false);
    setError('无法加载应用内容');
    onError?.('无法加载应用内容');
  }, [onError]);

  // 监听 iframe 加载失败（404 等）
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      try {
        // 尝试访问 iframe 内容，如果跨域或 404 会抛出异常
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          const bodyText = doc.body?.textContent || '';
          if (bodyText.includes('App not found') || bodyText.includes('File not found')) {
            setLoading(false);
            setError('no-app');
          }
        }
      } catch {
        // 跨域访问失败，忽略
      }
    };

    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [appId]);

  return (
    <div className="relative w-full h-full bg-white">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            <span className="text-sm text-gray-500">加载中...</span>
          </div>
        </div>
      )}

      {error && error !== 'no-app' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <div className="text-center">
            <p className="text-red-500 font-medium">{error}</p>
            <button
              onClick={() => {
                if (iframeRef.current) {
                  iframeRef.current.src = iframeRef.current.src;
                }
              }}
              className="mt-2 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {error === 'no-app' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <div className="text-center">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-lg font-medium text-gray-700 mb-2">暂无应用</p>
            <p className="text-sm text-gray-500">
              使用 skill 或 agent 构建前端应用后将在此处显示
            </p>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        key={appId}
        src={`/api/sandbox/apps/${appId.split('/').map(encodeURIComponent).join('/')}`}
        sandbox="allow-scripts"
        className="w-full h-full border-0"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        title={`sandbox-${appId}`}
      />
    </div>
  );
}

export default SandboxIframe;
