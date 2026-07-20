/**
 * useContextMenu Hook
 * 右键菜单逻辑
 */

import { useState, useCallback, useEffect } from 'react';
import useDesktopStore from '../store/desktopStore';
import type { MenuItem } from '@originos/core/types';

interface useContextMenuReturn {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  items: MenuItem[];
  open: (e: React.MouseEvent, menuItems: MenuItem[]) => void;
  close: () => void;
}

export function useContextMenu(): useContextMenuReturn {
  const contextMenu = useDesktopStore((state) => state.contextMenu);
  const openMenu = useDesktopStore((state) => state.openContextMenu);
  const closeMenu = useDesktopStore((state) => state.closeContextMenu);
  const [items, setItems] = useState<MenuItem[]>([]);

  const open = useCallback((e: React.MouseEvent, menuItems: MenuItem[]) => {
    e.preventDefault();
    e.stopPropagation();
    setItems(menuItems);
    openMenu({ x: e.clientX, y: e.clientY });
  }, [openMenu]);

  const close = useCallback(() => {
    closeMenu();
    setItems([]);
  }, [closeMenu]);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!contextMenu.isOpen) return;

    const handleClickOutside = () => {
      close();
    };

    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu.isOpen, close]);

  // ESC 键关闭菜单
  useEffect(() => {
    if (!contextMenu.isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [contextMenu.isOpen, close]);

  return {
    isOpen: contextMenu.isOpen,
    position: contextMenu.position,
    items,
    open,
    close,
  };
}

// 默认右键菜单项
export const DEFAULT_CONTEXT_MENU_ITEMS: MenuItem[] = [
  {
    id: 'refresh',
    label: '刷新',
    icon: '🔄',
    onClick: () => {
      window.location.reload();
    },
  },
  {
    id: 'separator-1',
    label: '',
    separator: true,
    onClick: () => {},
  },
  {
    id: 'new-folder',
    label: '新建',
    icon: '➕',
    shortcut: '⌘N',
    onClick: () => {
      // TODO: 实现新建设置
      console.log('新建 Folder');
    },
  },
  {
    id: 'settings',
    label: '设置',
    icon: '⚙️',
    shortcut: '⌘,',
    onClick: () => {
      // TODO: 打开设置
      console.log('打开设置');
    },
  },
];
