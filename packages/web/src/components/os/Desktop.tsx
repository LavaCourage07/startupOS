/**
 * Desktop Component - OS 桌面主容器
 */

import { useEffect, useCallback } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import useDesktopStore from '@/store/desktopStore';
import useDockStore from '@/store/dockStore';
import Background from './Background';
import StatusBar from './StatusBar';
import DesktopGrid from './DesktopGrid';
import ContextMenu from './ContextMenu';
import Dock from './dock';
import Spotlight from './spotlight';
import AgentInitializer from './AgentInitializer';
import { useSpotlight } from '@/hooks/useSpotlight';
import { useAgentLauncherStore } from '@/store/agentLauncherStore';
import { useAgentRegistryStore } from '@/store/agentRegistry';
import { DEFAULT_CONTEXT_MENU_ITEMS } from '@/hooks/useContextMenu';
import { SpotlightItem, SpotlightItemType } from '@originos/core/types';
import { AgentStatus } from '@originos/core/types';
import AgentDialog from './agent-host/AgentDialog';

// Static spotlight items - don't include dynamic agents
const STATIC_SPOTLIGHT_ITEMS: SpotlightItem[] = [
  {
    id: 'settings',
    type: SpotlightItemType.APP,
    title: '设置',
    subtitle: '系统设置',
    icon: '⚙️',
    action: () => console.log('Open Settings'),
    keywords: ['settings', 'preferences', '设置'],
  },
  {
    id: 'help',
    type: SpotlightItemType.APP,
    title: '帮助',
    subtitle: '获取帮助',
    icon: '❓',
    action: () => console.log('Open Help'),
    keywords: ['help', '帮助'],
  },
  {
    id: 'about',
    type: SpotlightItemType.APP,
    title: '关于',
    subtitle: '关于 OriginOS',
    icon: 'ℹ️',
    action: () => console.log('Open About'),
    keywords: ['about', '关于'],
  },
];

export default function Desktop() {
  const {
    icons,
    background,
    contextMenu,
    draggedIconId,
    openContextMenu,
    closeContextMenu,
    moveIcon,
    setDraggedIcon,
    setDragging,
    updateViewport,
    setLoading,
  } = useDesktopStore();

  // Agent launcher store - 读取打开的 Agent 对话框
  const openAgentIds = useAgentLauncherStore((state) => state.openAgentIds);
  const closeAgent = useAgentLauncherStore((state) => state.closeAgent);

  // 关闭 Agent 对话框时同步状态
  const handleCloseAgent = useCallback(
    (agentId: string) => {
      closeAgent(agentId);
      // 同步更新 Dock 图标状态
      useDockStore.getState().setAppRunning(agentId, false);
      // 同步更新 Agent Registry 状态
      useAgentRegistryStore.getState().setAgentStatus(agentId, AgentStatus.IDLE as AgentStatus);
    },
    [closeAgent]
  );

  // 在 Desktop 组件中添加全局快捷键监听（始终挂载）
  useSpotlight();

  // 初始化
  useEffect(() => {
    setLoading(false);
    updateViewport({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    const handleResize = () => {
      updateViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setLoading, updateViewport]);

  // 拖拽开始
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = event.active.id as string;
      setDraggedIcon(id);
      setDragging(true);
    },
    [setDraggedIcon, setDragging]
  );

  // 拖拽结束
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const id = active.id as string;

      setDraggedIcon(null);
      setDragging(false);

      if (over) {
        const ICON_SIZE = 64;
        const GAP = 24;
        const START_X = 48;
        const START_Y = 72;

        const overData = over.data.current as { x: number; y: number };
        const newX = Math.round((overData.x - START_X) / (ICON_SIZE + GAP));
        const newY = Math.round((overData.y - START_Y) / (ICON_SIZE + GAP));

        moveIcon(id, { x: Math.max(0, newX), y: Math.max(0, newY) });
      }
    },
    [setDraggedIcon, setDragging, moveIcon]
  );

  // 处理右键菜单
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      openContextMenu({ x: e.clientX, y: e.clientY });
    },
    [openContextMenu]
  );

  // 处理图标点击
  const handleIconClick = useCallback((id: string) => {
    const icon = icons.find((i) => i.id === id);
    if (icon) {
      console.log('Icon clicked:', icon);
    }
  }, [icons]);

  // 获取拖拽中的图标
  const activeIcon = draggedIconId
    ? icons.find((icon) => icon.id === draggedIconId)
    : null;

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-neutral-950"
      onContextMenu={handleContextMenu}
    >
      {/* Agent Initializer - Loads default agents */}
      <AgentInitializer />

      <StatusBar />
      <Background config={background} />

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <DesktopGrid
          icons={icons}
          onIconClick={handleIconClick}
          onIconRightClick={() => {}}
        />

        {activeIcon && (
          <DragOverlay>
            <div className="flex flex-col items-center gap-1 p-2 bg-white/20 backdrop-blur rounded-lg">
              <span className="text-4xl">{activeIcon.icon}</span>
              <span className="text-xs text-white/90">{activeIcon.label}</span>
            </div>
          </DragOverlay>
        )}
      </DndContext>

      {contextMenu.position && (
        <ContextMenu
          position={contextMenu.position}
          items={DEFAULT_CONTEXT_MENU_ITEMS}
          isOpen={contextMenu.isOpen}
          onClose={closeContextMenu}
        />
      )}

      <Dock />
      <Spotlight items={STATIC_SPOTLIGHT_ITEMS} />

      {/* Agent 对话框 */}
      {openAgentIds.map((agentId) => (
        <AgentDialog
          key={agentId}
          agentId={agentId}
          isOpen={true}
          onClose={() => handleCloseAgent(agentId)}
        />
      ))}
    </div>
  );
}
