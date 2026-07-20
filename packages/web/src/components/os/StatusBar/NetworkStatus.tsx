/**
 * NetworkStatus Component - 网络状态显示
 */

import { useState, useEffect } from 'react';
import { NetworkStatus as NetworkStatusType } from '@originos/core/types';

export default function NetworkStatus() {
  // 解决 SSR hydration 不匹配问题：使用 mounted 确保客户端渲染后才同步真实状态
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<NetworkStatusType>({
    isOnline: true, // 初始默认值（SSR和客户端一致）
    type: 'wifi',
    strength: 3,
  });

  // 组件挂载后同步真实网络状态
  useEffect(() => {
    setMounted(true);
    setStatus({
      isOnline: navigator.onLine,
      type: 'wifi',
      strength: 3,
    });
  }, []);

  // 监听网络状态变化
  useEffect(() => {
    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getIcon = () => {
    // Hydration 阶段返回静态图标避免不匹配
    if (!mounted) {
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="8" cy="12" r="1" />
          <path d="M8 9 Q 14 6, 14 6" />
          <path d="M8 6 Q 16 2, 16 2" />
          <path d="M8 3 Q 18 -1, 18 -1" />
        </svg>
      );
    }

    if (!status.isOnline) {
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M1 1 L15 15" />
          <path d="M2 4 L6 8" />
          <path d="M6 7 L10 11" />
          <path d="M10 10 L14 14" />
        </svg>
      );
    }

    if (status.type === 'none' || status.type === 'ethernet') {
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="2" y="8" width="2" height="6" rx="0.5" />
          <rect x="6" y="6" width="2" height="8" rx="0.5" />
          <rect x="10" y="4" width="2" height="10" rx="0.5" />
          <rect x="14" y="2" width="2" height="12" rx="0.5" />
        </svg>
      );
    }

    // WiFi 图标 - 使用简化的有效SVG路径
    const strength = status.strength ?? 3;
    const bars = Array.from({ length: 4 }, (_, i) => i < strength);

    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="12" r="1" stroke="currentColor" strokeWidth="2" fill="none" />
        <path
          d={`M8 9 Q ${bars[2] ? 14 : 12} 6, ${bars[2] ? 14 : 12} 6`}
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          opacity={bars[2] ? 1 : 0.3}
        />
        <path
          d={`M8 6 Q ${bars[1] ? 16 : 13} 2, ${bars[1] ? 16 : 13} 2`}
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          opacity={bars[1] ? 1 : 0.3}
        />
        <path
          d={`M8 3 Q ${bars[0] ? 18 : 14} -1, ${bars[0] ? 18 : 14} -1`}
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          opacity={bars[0] ? 1 : 0.3}
        />
      </svg>
    );
  };

  return (
    <div className="flex items-center text-white/80" title={status.isOnline ? '已连接' : '离线'}>
      {getIcon()}
    </div>
  );
}
