/**
 * OriginOS 侧边栏组件
 * Fluent OS 风格的侧边导航栏
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@originos/core/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  badge?: string | number;
}

// ============================================================================
// Mock Data
// ============================================================================

const NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    label: '主页',
    icon: '🏠',
    path: '/',
  },
  {
    id: 'apps',
    label: '应用中心',
    icon: '📱',
    path: '/apps',
    badge: '12',
  },
  {
    id: 'settings',
    label: '设置',
    icon: '⚙️',
    path: '/settings',
  },
];

// ============================================================================
// Component: Sidebar Navigation Item
// ============================================================================

function NavItem({
  item,
  isActive,
}: {
  item: NavItem;
  isActive: boolean;
}) {
  const href = typeof window === 'undefined' ? item.path : item.path;

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
        'text-sm font-medium',
        !isActive && 'text-text-secondary hover:bg-muted',
        isActive && 'bg-primary/10 text-primary',
        'group'
      )}
    >
      <span className="text-base">{item.icon}</span>
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span className={cn(
          'px-2 py-0.5 rounded-full text-xs',
          isActive ? 'bg-primary text-background' : 'bg-muted text-text-foreground'
        )}>
          {item.badge}
        </span>
      )}
    </Link>
  );
}

// ============================================================================
// Component: Sidebar
// ============================================================================

interface SidebarProps {
  className?: string;
  isCollapsed?: boolean;
  onCollapseToggle?: () => void;
}

export function Sidebar({ className, isCollapsed = false, onCollapseToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'flex flex-col bg-surface/80 backdrop-blur-xl border-r border-border',
        'transition-all duration-300 ease-out',
        isCollapsed ? 'w-16' : 'w-72',
        className
      )}
    >
      {/* Logo Section */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 flex-shrink-0">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <div className="absolute -right-2 top-0 w-2 h-2 rounded-full bg-primary" />
              <div className="absolute -left-1 top-1 w-2 h-2 rounded-full bg-primary" />
              <div className="absolute -right-1 top-1 w-2 h-2 rounded-full bg-primary" />
            </div>
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-base font-semibold text-text-primary">
                OriginOS
              </h1>
              <p className="text-xs text-muted-foreground">
                AI Native OS
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            isActive={pathname === item.path}
          />
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-4 border-t border-border">
        <button
          onClick={onCollapseToggle}
          className={cn(
            'flex items-center justify-center w-full p-2 rounded-lg transition-colors',
            'text-text-secondary hover:bg-muted',
            'group'
          )}
          title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {isCollapsed ? '▶' : '◀'}
        </button>
      </div>
    </aside>
  );
}
