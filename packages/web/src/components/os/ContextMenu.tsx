/**
 * ContextMenu Component - 右键菜单
 */

import React, { useEffect, useRef } from 'react';
import type { ContextMenuProps } from '@originos/core/types';

export default function ContextMenu({
  position,
  items,
  isOpen,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[180px] bg-gray-900/95 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {items.map((item) => {
        if (item.separator) {
          return (
            <div key={item.id} className="h-px bg-white/20 my-1" />
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className="w-full px-4 py-2 flex items-center gap-3 text-left text-sm text-white/90 hover:bg-white/10 transition-colors"
          >
            {item.icon && <span className="text-base">{item.icon}</span>}
            <span className="flex-1">{item.label}</span>
            {item.shortcut && (
              <span className="text-xs text-white/50">{item.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
