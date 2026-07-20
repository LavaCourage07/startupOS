/**
 * OS.9: useViewReconciler Hook
 * 封装 ViewReconcilerAdapter，提供视图生命周期管理
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  viewReconcilerAdapter,
  ViewLifecycleCallbacks,
} from '@/services/ViewReconcilerAdapter';
import { AppWindowContent } from '@originos/core/types';

export interface UseViewReconcilerOptions {
  windowId: string;
  content: AppWindowContent;
  containerId?: string;
  context?: Record<string, unknown>;
  autoCreate?: boolean;
  lifecycleCallbacks?: Partial<ViewLifecycleCallbacks>;
}

export interface UseViewReconcilerReturn {
  // 状态
  viewId: string | null;
  isCreated: boolean;
  isLoading: boolean;
  error: string | null;

  // 视图操作
  createView: () => string | null;
  startView: () => void;
  pauseView: () => void;
  resumeView: (isActive?: boolean) => void;
  stopView: () => void;
  destroyView: () => void;
  refreshView: () => void;

  // 通信
  sendMessage: (type: string, payload: any) => void;
  broadcast: (type: string, payload: any) => void;
  onMessage: (type: string, callback: (payload: any) => void) => void;
  offMessage: (type: string) => void;

  // 工具
  isModulesAvailable: () => boolean;
  getViewIds: () => string[];
  hasView: (viewId: string) => boolean;
}

export function useViewReconciler(options: UseViewReconcilerOptions): UseViewReconcilerReturn {
  const {
    windowId,
    content,
    containerId,
    context,
    autoCreate = true,
    lifecycleCallbacks = {},
  } = options;

  const [viewId, setViewId] = useState<string | null>(null);
  const [isCreated, setIsCreated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 使用 ref 存储消息监听器，便于清理
  const messageListenersRef = useRef<Map<string, (payload: any) => void>>(new Map());

  // 合并生命周期回调
  const mergedCallbacks: ViewLifecycleCallbacks = {
    onCreate: () => {
      setIsCreated(true);
      setIsLoading(false);
      lifecycleCallbacks.onCreate?.();
    },
    onStart: () => {
      lifecycleCallbacks.onStart?.();
    },
    onPause: () => {
      lifecycleCallbacks.onPause?.();
    },
    onResume: () => {
      lifecycleCallbacks.onResume?.();
    },
    onStop: () => {
      lifecycleCallbacks.onStop?.();
    },
    onDestroy: () => {
      setIsCreated(false);
      setViewId(null);
      lifecycleCallbacks.onDestroy?.();
    },
  };

  // 创建视图
  const createView = useCallback((): string | null => {
    // 只处理需要 ViewReconciler 的类型
    if (
      content.type !== 'view' &&
      content.type !== 'microapp' &&
      content.type !== 'qiankun'
    ) {
      console.warn('useViewReconciler: Content type does not require ViewReconciler');
      return null;
    }

    const actualContainerId = containerId || `view-container-${windowId}`;

    setIsLoading(true);
    setError(null);

    try {
      const id = viewReconcilerAdapter.createView(
        {
          windowId,
          content,
          containerId: actualContainerId,
          context,
        },
        mergedCallbacks
      );

      setViewId(id);
      return id;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create view';
      console.error('useViewReconciler: Failed to create view', err);
      setError(errorMsg);
      setIsLoading(false);
      return null;
    }
  }, [windowId, content, containerId, context, mergedCallbacks]);

  // 启动视图
  const startView = useCallback(() => {
    if (!viewId) {
      console.warn('useViewReconciler: No view to start');
      return;
    }
    viewReconcilerAdapter.startView(viewId);
  }, [viewId]);

  // 暂停视图
  const pauseView = useCallback(() => {
    if (!viewId) {
      console.warn('useViewReconciler: No view to pause');
      return;
    }
    viewReconcilerAdapter.pauseView(viewId);
  }, [viewId]);

  // 恢复视图
  const resumeView = useCallback((isActive: boolean = true) => {
    if (!viewId) {
      console.warn('useViewReconciler: No view to resume');
      return;
    }
    viewReconcilerAdapter.resumeView(viewId, isActive);
  }, [viewId]);

  // 停止视图
  const stopView = useCallback(() => {
    if (!viewId) {
      console.warn('useViewReconciler: No view to stop');
      return;
    }
    viewReconcilerAdapter.stopView(viewId);
  }, [viewId]);

  // 销毁视图
  const destroyView = useCallback(() => {
    if (!viewId) {
      return;
    }
    viewReconcilerAdapter.destroyView(viewId);
    setViewId(null);
    setIsCreated(false);
  }, [viewId]);

  // 刷新视图
  const refreshView = useCallback(() => {
    if (!viewId) {
      console.warn('useViewReconciler: No view to refresh');
      return;
    }
    viewReconcilerAdapter.refreshView(viewId);
  }, [viewId]);

  // 发送消息到视图
  const sendMessage = useCallback((type: string, payload: any) => {
    if (!viewId) {
      console.warn('useViewReconciler: No view to send message to');
      return;
    }
    viewReconcilerAdapter.sendToView(viewId, type, payload);
  }, [viewId]);

  // 广播消息到所有视图
  const broadcast = useCallback((type: string, payload: any) => {
    viewReconcilerAdapter.broadcast(type, payload);
  }, []);

  // 监听消息
  const onMessage = useCallback((type: string, callback: (payload: any) => void) => {
    messageListenersRef.current.set(type, callback);
    viewReconcilerAdapter.onMessage(type, callback);
  }, []);

  // 移除监听
  const offMessage = useCallback((type: string) => {
    messageListenersRef.current.delete(type);
    viewReconcilerAdapter.offMessage(type);
  }, []);

  // 工具函数
  const isModulesAvailable = useCallback(() => {
    return viewReconcilerAdapter.isModulesAvailable();
  }, []);

  const getViewIds = useCallback(() => {
    return viewReconcilerAdapter.getViewIds();
  }, []);

  const hasView = useCallback((vid: string) => {
    return viewReconcilerAdapter.hasView(vid);
  }, []);

  // 自动创建视图
  useEffect(() => {
    if (autoCreate && !isCreated && !isLoading) {
      createView();
    }
  }, [autoCreate, isCreated, isLoading, createView]);

  // 清理
  useEffect(() => {
    return () => {
      // 销毁视图
      if (viewId) {
        viewReconcilerAdapter.destroyView(viewId);
      }

      // 清理所有消息监听器
      messageListenersRef.current.forEach((_, type) => {
        viewReconcilerAdapter.offMessage(type);
      });
      messageListenersRef.current.clear();
    };
  }, [viewId]);

  return {
    viewId,
    isCreated,
    isLoading,
    error,

    createView,
    startView,
    pauseView,
    resumeView,
    stopView,
    destroyView,
    refreshView,

    sendMessage,
    broadcast,
    onMessage,
    offMessage,

    isModulesAvailable,
    getViewIds,
    hasView,
  };
}

export default useViewReconciler;
