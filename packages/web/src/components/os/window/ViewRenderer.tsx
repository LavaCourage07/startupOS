/**
 * OS.9: 视图渲染器组件
 * 根据内容类型渲染不同的视图
 * 支持: component, iframe, microapp, qiankun, view
 */

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ViewRendererProps,
  ComponentContent,
  IframeContent,
  MicroAppContent,
  QiankunContent,
  ViewContent,
} from '@originos/core/types';
import { viewReconcilerAdapter, ViewLifecycleCallbacks } from '@/services/ViewReconcilerAdapter';

// 加载状态组件
const LoadingSpinner: React.FC = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-900/50 z-10">
    <div className="flex flex-col items-center gap-2">
      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      <span className="text-sm text-gray-500">加载中...</span>
    </div>
  </div>
);

// 错误状态组件
const ErrorDisplay: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 z-10">
    <div className="text-center p-4">
      <div className="text-red-500 mb-2">
        <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <p className="font-medium text-gray-900 dark:text-white">加载失败</p>
      <p className="text-sm text-gray-500 mt-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          重试
        </button>
      )}
    </div>
  </div>
);

// 空状态组件
const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-center justify-center h-full text-gray-500">
    <div className="text-center">
      <svg className="w-16 h-16 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p>{message}</p>
    </div>
  </div>
);

export function ViewRenderer({ content, windowId }: ViewRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  // 视图生命周期回调
  const lifecycleCallbacks: ViewLifecycleCallbacks = React.useMemo(() => ({
    onCreate: () => {
      console.log(`ViewRenderer: View ${windowId} created`);
    },
    onStart: () => {
      console.log(`ViewRenderer: View ${windowId} started`);
    },
    onPause: () => {
      console.log(`ViewRenderer: View ${windowId} paused`);
    },
    onResume: () => {
      console.log(`ViewRenderer: View ${windowId} resumed`);
    },
    onStop: () => {
      console.log(`ViewRenderer: View ${windowId} stopped`);
    },
    onDestroy: () => {
      console.log(`ViewRenderer: View ${windowId} destroyed`);
    },
  }), [windowId]);

  // 初始化视图
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    // 只有 view, microapp, qiankun 类型需要通过 ViewReconciler 初始化
    if (content.type === 'view' || content.type === 'microapp' || content.type === 'qiankun') {
      const viewContent = content as ViewContent;
      const containerId = `view-container-${windowId}`;

      // 延迟初始化，等待容器渲染
      const timer = setTimeout(() => {
        try {
          const id = viewReconcilerAdapter.createView(
            {
              windowId,
              content,
              containerId,
              context: viewContent.context,
            },
            lifecycleCallbacks
          );
          setViewId(id);
          setIsLoading(false);
        } catch (err) {
          console.error('ViewRenderer: Failed to create view', err);
          setError(err instanceof Error ? err.message : '视图初始化失败');
          setIsLoading(false);
        }
      }, 0);

      return () => {
        clearTimeout(timer);
        if (viewId) {
          viewReconcilerAdapter.destroyView(viewId);
        }
      };
    }

    setIsLoading(false);
    return undefined;
  }, [content, windowId, lifecycleCallbacks, viewId]);

  // 重试函数
  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);

    // 重新初始化视图
    if (content.type === 'view' || content.type === 'microapp' || content.type === 'qiankun') {
      const viewContent = content as ViewContent;
      const containerId = `view-container-${windowId}`;

      try {
        const id = viewReconcilerAdapter.createView(
          {
            windowId,
            content,
            containerId,
            context: viewContent.context,
          },
          lifecycleCallbacks
        );
        setViewId(id);
      } catch (err) {
        console.error('ViewRenderer: Failed to create view on retry', err);
        setError(err instanceof Error ? err.message : '视图初始化失败');
      }
    }

    setIsLoading(false);
  }, [content, windowId, lifecycleCallbacks]);

  // 处理 iframe 加载
  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleIframeError = useCallback(() => {
    setIsLoading(false);
    setError('无法加载 iframe 内容');
  }, []);

  // 渲染 React 组件
  if (content.type === 'component') {
    const componentContent = content as ComponentContent;
    const Component = componentContent.component;

    return (
      <div className="w-full h-full overflow-auto">
        <Component {...componentContent.props} />
        {componentContent.children}
      </div>
    );
  }

  // 渲染 iframe
  if (content.type === 'iframe') {
    const iframeContent = content as IframeContent;

    return (
      <div className="w-full h-full relative">
        {isLoading && <LoadingSpinner />}
        {error && <ErrorDisplay message={error} onRetry={handleRetry} />}
        <iframe
          src={iframeContent.url}
          sandbox={iframeContent.sandbox}
          className="w-full h-full border-0"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          title={`iframe-${windowId}`}
        />
      </div>
    );
  }

  // 渲染微前端 (microapp)
  if (content.type === 'microapp') {
    const microappContent = content as MicroAppContent;

    return (
      <div className="w-full h-full relative">
        {isLoading && <LoadingSpinner />}
        {error && <ErrorDisplay message={error} onRetry={handleRetry} />}
        <div
          ref={containerRef}
          id={`view-container-${windowId}`}
          className="w-full h-full"
          data-microapp-name={microappContent.name}
          data-microapp-url={microappContent.url}
        >
          {!isLoading && !error && !viewId && (
            <EmptyState message="微前端应用加载中..." />
          )}
        </div>
      </div>
    );
  }

  // 渲染 qiankun 微前端
  if (content.type === 'qiankun') {
    const qiankunContent = content as QiankunContent;

    return (
      <div className="w-full h-full relative">
        {isLoading && <LoadingSpinner />}
        {error && <ErrorDisplay message={error} onRetry={handleRetry} />}
        <div
          ref={containerRef}
          id={`view-container-${windowId}`}
          className="w-full h-full"
          data-qiankun-name={qiankunContent.name}
          data-qiankun-url={qiankunContent.url}
        >
          {!isLoading && !error && !viewId && (
            <EmptyState message="Qiankun 应用加载中..." />
          )}
        </div>
      </div>
    );
  }

  // 渲染通用视图 (使用 view-reconciler)
  if (content.type === 'view') {
    const viewContent = content as ViewContent;

    return (
      <div className="w-full h-full relative">
        {isLoading && <LoadingSpinner />}
        {error && <ErrorDisplay message={error} onRetry={handleRetry} />}
        <div
          ref={containerRef}
          id={`view-container-${windowId}`}
          data-view-id={viewContent.viewId}
          data-view-code={viewContent.viewCode}
          className="w-full h-full"
        >
          {!isLoading && !error && !viewId && (
            <EmptyState message="视图加载中..." />
          )}
        </div>
      </div>
    );
  }

  // 未知类型
  return (
    <div className="flex items-center justify-center h-full text-gray-500">
      <div className="text-center">
        <svg className="w-16 h-16 mx-auto mb-2 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p>不支持的视图类型: {(content as any).type}</p>
      </div>
    </div>
  );
}

export default ViewRenderer;
