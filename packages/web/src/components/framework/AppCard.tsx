/**
 * OriginOS 应用卡片组件
 * Fluent OS 风格的应用卡片
 */
/* eslint-disable react/function-component-definition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable @next/next/no-img-element */

'use client';

import * as React from 'react';
import { Pin, Trash2 } from 'lucide-react';

import { AppIcon } from '@/components/ui/icon-registry';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@originos/core/lib/utils';
import { syncDockApps } from '@originos/core/lib/integrations/electron/window';
import useDockStore from '@/store/dockStore';

// ============================================================================
// Types
// ============================================================================

interface AppCardProps {
  id: string;
  name: string;
  description: string;
  icon: string;
  path?: string;
  color?: string;
  onClick?: () => void;
  action?: 'install' | 'update' | 'launch';
  rightAction?: React.ReactNode;
  className?: string;
  /** Optional delete callback - when provided, shows delete button on hover */
  onDelete?: () => void;
  /** Dock type metadata */
  dockType?: 'agent' | 'skill' | 'action';
  /** Skill code for dockType='skill' */
  skillName?: string;
  /** Stable tour marker used by the desktop onboarding overlay */
  tourId?: string;
}

// ============================================================================
// Component: App Card
// ============================================================================

export function AppCard({
  id,
  name,
  description,
  icon,
  path,
  color = 'bg-purple-500',
  onClick,
  action = 'launch',
  rightAction,
  className,
  onDelete,
  dockType,
  skillName,
  tourId,
}: AppCardProps) {
  const { apps, addApp } = useDockStore();
  const isPinnedToDock = apps.some(app => app.id === id);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const handleClick = () => {
    if (path) {
      window.location.href = path;
    } else if (onClick) {
      onClick();
    }
  };

  const handlePinToDock = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPinnedToDock) {
      addApp({
        id,
        name,
        icon,
        iconType: 'emoji',
        isRunning: false,
        isPinned: true,
        appType: dockType,
        skillName,
      });
      // Sync to dock window in Electron (separate BrowserWindow with its own store)
      const updatedApps = useDockStore.getState().apps;
      syncDockApps(updatedApps);
    }
  };

  const confirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
    setShowDeleteConfirm(false);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  const getActionButton = () => {
    switch (action) {
      case 'launch':
        return (
          <Button
            onClick={handleClick}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            打开
          </Button>
        );
      case 'install':
        return (
          <Button
            onClick={handleClick}
            size="sm"
            className={cn('mt-3 bg-surface', 'hover:bg-surface/80')}
          >
            获取
          </Button>
        );
      case 'update':
        return (
          <Button onClick={handleClick} variant="outline" size="sm" className="mt-3">
            更新
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative" data-tour={tourId}>
      {/* Delete Confirmation Overlay */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center gap-3 z-20">
          <p className="text-white text-sm font-medium px-4 text-center leading-relaxed">
            确定要删除「{name}」吗？
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmDelete}
              className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors text-sm font-medium"
            >
              删除
            </button>
            <button
              onClick={cancelDelete}
              className="px-4 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors text-sm font-medium"
            >
              取消
            </button>
          </div>
        </div>
      )}

    <Card
      className={cn(
        'group h-full cursor-pointer overflow-hidden border-white/10 bg-white/5 text-card-foreground shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-white/[0.07] hover:shadow-[0_28px_80px_rgba(0,0,0,0.34)]',
        className
      )}
      onClick={handleClick}
    >
      <div className="p-5">
        {/* Icon and Action */}
        <div className="flex items-start justify-between mb-3">
          <div
            className={cn(
              'relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl bg-gradient-to-br',
              'from-[var(--tw-gradient-from)] to-[var(--tw-gradient-to)] shadow-md',
              'group-hover:shadow-lg transition-shadow'
            )}
            style={{
              '--tw-gradient-from': `${color}20`,
              '--tw-gradient-to': `${color}5`,
            } as React.CSSProperties}
          >
            <div className="pointer-events-none absolute inset-[1px] rounded-2xl border border-white/10" />
            {icon.startsWith('data:') || icon.startsWith('http') ? (
              <img src={icon} alt={name} className="w-8 h-8" />
            ) : (
              <AppIcon emoji={icon} size={28} />
            )}
          </div>
          <div className="flex items-center gap-1.5">
          {/* Pin to Dock Button */}
          <button
            onClick={handlePinToDock}
            disabled={isPinnedToDock}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              isPinnedToDock
                ? 'text-primary bg-primary/10 cursor-default'
                : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
            )}
            title={isPinnedToDock ? '已固定到 Dock' : '固定到 Dock'}
          >
            <Pin className={cn('w-4 h-4', isPinnedToDock && 'fill-current')} />
          </button>
          {/* Delete Button */}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
              className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors opacity-0 group-hover:opacity-100"
              title="删除"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          )}
          </div>
          {/* Right Action */}
          {rightAction}
        </div>

        {/* App Info */}
        <div>
          <h3 className="font-medium text-text-primary mb-1 group-hover:text-primary transition-colors">
            {name}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 min-h-[2.5rem]" title={description}>
            {description}
          </p>
        </div>

        {/* Action Button */}
        {getActionButton()}
      </div>
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
    </Card>
    </div>
  );
}
