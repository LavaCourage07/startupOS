/**
 * useDockContextMenu Hook - Dock 右键菜单
 */

import { useState, useCallback, useEffect } from 'react';
import type { MenuItem } from '@originos/core/types';
import useDockStore from '@/store/dockStore';

interface UseDockContextMenuOptions {
  appId: string;
  appName: string;
  isPinned: boolean;
  onOpen?: () => void;
}

interface UseDockContextMenuReturn {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  items: MenuItem[];
  close: () => void;
}

export function useDockContextMenu(
  options: UseDockContextMenuOptions
): UseDockContextMenuReturn {
  const { appId, isPinned } = options;
  const dockContextMenu = useDockStore((s) => s.dockContextMenu);
  const closeDockContextMenu = useDockStore((s) => s.closeDockContextMenu);
  const pinApp = useDockStore((s) => s.pinApp);
  const removeApp = useDockStore((s) => s.removeApp);
  const [items, setItems] = useState<MenuItem[]>([]);
  // 生成菜单项
  useEffect(() => {
    setItems([
      {
        id: 'open',
        label: '打开',
        icon: '📂',
        onClick: () => {
          console.log(`Open app: ${appId}`);
          window.dispatchEvent(
            new CustomEvent('app-open', { detail: { appId } })
          );
        },
      },
      {
        id: 'separator-1',
        label: '',
        separator: true,
        onClick: () => {},
      },
      {
        id: isPinned ? 'unpin' : 'pin',
        label: isPinned ? '从 Dock 移除' : '固定到 Dock',
        icon: isPinned ? '❌' : '📌',
        onClick: () => (isPinned ? removeApp(appId) : pinApp(appId)),
      },
      {
        id: 'separator-2',
        label: '',
        separator: true,
        onClick: () => {},
      },
      {
        id: 'uninstall',
        label: '卸载',
        icon: '🗑️',
        onClick: () => removeApp(appId),
      },
    ]);
  }, [appId, isPinned, pinApp, removeApp]);

  const isOpen = dockContextMenu.isOpen && dockContextMenu.appId === appId;
  const position = dockContextMenu.position;

  const close = useCallback(() => {
    closeDockContextMenu();
  }, [closeDockContextMenu]);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = () => {
      close();
    };

    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, close]);

  // ESC 键关闭菜单
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, close]);

  return {
    isOpen,
    position,
    items,
    close,
  };
}
