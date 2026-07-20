/**
 * 像素风格图标组件
 * 所有图标使用内联 SVG，24x24 网格像素风格
 */

import * as React from 'react';

const PIXEL = 24; // SVG viewBox size
const BASE_SCALE = 2; // each "pixel" is 2 SVG units = 12x12 pixel grid

interface PixelIconProps {
  className?: string;
  size?: number;
  color?: string;
}

function PixelIconSVG({ d, className, size = 32, color = 'currentColor' }: {
  d: string[];
  className?: string;
  size?: number;
  color?: string;
}) {
  // Calculate viewBox to fit all paths
  const viewBox = `0 0 ${PIXEL} ${PIXEL}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ imageRendering: 'pixelated' }}
    >
      {d.map((path, i) => (
        <path key={i} d={path} fill={color} />
      ))}
    </svg>
  );
}

// Pixel art path generator - creates rect paths for pixel art
function px(x: number, y: number, s: number = BASE_SCALE): string {
  return `M${x} ${y}h${s}v${s}h-${s}z`;
}

// ============================================================================
// Individual Pixel Icons
// ============================================================================

/** 📋 任务管理器 - 剪贴板 */
export function PixelClipboard({ className, size, color }: PixelIconProps) {
  const d = [
    px(6,2), px(8,2), px(10,2), px(12,2), px(14,2), px(16,2),
    px(4,4), px(6,4), px(16,4), px(18,4),
    px(4,6), px(6,6), px(8,6), px(10,6), px(12,6), px(14,6), px(16,6), px(18,6),
    px(4,8), px(18,8),
    px(4,10), px(18,10),
    px(4,12), px(18,12),
    px(4,14), px(8,14), px(14,14), px(18,14),
    px(4,16), px(18,16),
    px(4,18), px(6,18), px(16,18), px(18,18),
    px(4,20), px(6,20), px(16,20), px(18,20),
    // Checkmark
    px(8,10), px(10,10),
    px(6,12), px(8,12),
    px(10,12), px(12,12),
    px(14,10), px(16,10),
  ];
  return <PixelIconSVG d={d} className={className} size={size} color={color} />;
}

/** 🕸️ 网络/图谱 - 蜘蛛网 */
export function PixelWeb({ className, size, color }: PixelIconProps) {
  const d = [
    // Cross lines
    px(12,2), px(12,4), px(12,6), px(12,8), px(12,10), px(12,12),
    px(2,12), px(4,12), px(6,12), px(8,12), px(10,12), px(14,12), px(16,12), px(18,12), px(20,12), px(22,12),
    px(12,14), px(12,16), px(12,18), px(12,20), px(12,22),
    // Diagonals
    px(4,4), px(6,6), px(8,8), px(10,10),
    px(14,14), px(16,16), px(18,18), px(20,20),
    px(20,4), px(18,6), px(16,8), px(14,10),
    px(10,14), px(8,16), px(6,18), px(4,20),
    // Web rings
    px(10,4), px(12,4), px(14,4),
    px(8,6), px(16,6),
    px(6,8), px(18,8),
    px(10,20), px(12,20), px(14,20),
    px(8,18), px(16,18),
    px(6,16), px(18,16),
  ];
  return <PixelIconSVG d={d} className={className} size={size} color={color} />;
}

/** 🔍 搜索 - 放大镜 */
export function PixelSearch({ className, size, color }: PixelIconProps) {
  const d = [
    // Circle
    px(6,2), px(8,2), px(10,2), px(12,2), px(14,2),
    px(4,4), px(16,4),
    px(4,6), px(16,6),
    px(4,8), px(16,8),
    px(4,10), px(16,10),
    px(6,12), px(8,12), px(10,12), px(12,12), px(14,12),
    // Handle
    px(14,14), px(16,16), px(18,18), px(20,20), px(22,22),
    px(16,14), px(18,16), px(20,18), px(22,20),
  ];
  return <PixelIconSVG d={d} className={className} size={size} color={color} />;
}

/** 🤖 机器人/Agent */
export function PixelRobot({ className, size, color }: PixelIconProps) {
  const d = [
    // Antenna
    px(10,0), px(12,0), px(14,0),
    px(12,2),
    // Head
    px(4,4), px(6,4), px(8,4), px(10,4), px(12,4), px(14,4), px(16,4), px(18,4),
    px(4,6), px(18,6),
    px(4,8), px(6,8), px(8,8), px(10,8), px(12,8), px(14,8), px(16,8), px(18,8),
    // Eyes
    px(6,10), px(8,10), px(10,10), px(14,10), px(16,10), px(18,10),
    // Mouth
    px(6,12), px(8,12), px(10,12), px(12,12), px(14,12), px(16,12), px(18,12),
    // Body
    px(4,14), px(6,14), px(8,14), px(10,14), px(12,14), px(14,14), px(16,14), px(18,14),
    px(4,16), px(18,16),
    px(4,18), px(6,18), px(8,18), px(10,18), px(12,18), px(14,18), px(16,18), px(18,18),
    px(6,20), px(8,20), px(14,20), px(16,20),
  ];
  return <PixelIconSVG d={d} className={className} size={size} color={color} />;
}

/** 🎭 角色/面具 */
export function PixelMask({ className, size, color }: PixelIconProps) {
  const d = [
    // Top
    px(6,2), px(8,2), px(10,2), px(12,2), px(14,2), px(16,2),
    px(4,4), px(18,4),
    px(4,6), px(6,6), px(8,6), px(10,6), px(12,6), px(14,6), px(16,6), px(18,6),
    // Eyes
    px(4,8), px(6,8), px(8,8), px(14,8), px(16,8), px(18,8),
    px(4,10), px(6,10), px(16,10), px(18,10),
    // Bottom
    px(6,12), px(8,12), px(10,12), px(12,12), px(14,12), px(16,12),
    px(6,14), px(8,14), px(14,14), px(16,14),
    px(6,16), px(8,16), px(14,16), px(16,16),
    // Handle
    px(10,16), px(12,16),
    px(10,18), px(12,18),
    px(10,20), px(12,20),
    px(10,22), px(12,22),
  ];
  return <PixelIconSVG d={d} className={className} size={size} color={color} />;
}

/** ⚡ 闪电/Skill */
export function PixelLightning({ className, size, color }: PixelIconProps) {
  const d = [
    px(12,0), px(14,0),
    px(10,2), px(12,2),
    px(10,4), px(12,4),
    px(8,6), px(10,6), px(12,6),
    px(8,8), px(10,8), px(12,8),
    px(6,10), px(8,10), px(10,10),
    px(6,12), px(8,12), px(10,12),
    px(8,14), px(10,14), px(12,14), px(14,14),
    px(10,16), px(12,16), px(14,16),
    px(10,18), px(12,18), px(14,18), px(16,18),
    px(12,20), px(14,20), px(16,20),
    px(12,22), px(14,22), px(16,22),
    px(14,24), px(16,24),
  ];
  return <PixelIconSVG d={d} className={className} size={size} color={color} />;
}

/** ➕ 加号/创建 */
export function PixelPlus({ className, size, color }: PixelIconProps) {
  const d = [
    px(10,2), px(12,2), px(14,2),
    px(10,4), px(12,4), px(14,4),
    px(2,10), px(4,10), px(6,10), px(8,10), px(10,10), px(12,10), px(14,10), px(16,10), px(18,10), px(20,10), px(22,10),
    px(2,12), px(4,12), px(6,12), px(8,12), px(10,12), px(12,12), px(14,12), px(16,12), px(18,12), px(20,12), px(22,12),
    px(2,14), px(4,14), px(6,14), px(8,14), px(10,14), px(12,14), px(14,14), px(16,14), px(18,14), px(20,14), px(22,14),
    px(10,16), px(12,16), px(14,16),
    px(10,18), px(12,18), px(14,18),
    px(10,20), px(12,20), px(14,20),
  ];
  return <PixelIconSVG d={d} className={className} size={size} color={color} />;
}

/** 📝 笔记/文档 */
export function PixelNote({ className, size, color }: PixelIconProps) {
  const d = [
    px(6,0), px(8,0), px(10,0), px(12,0), px(14,0), px(16,0),
    px(4,2), px(18,2),
    px(4,4), px(6,4), px(16,4), px(18,4),
    px(4,6), px(6,6), px(16,6), px(18,6),
    px(4,8), px(18,8),
    px(4,10), px(18,10),
    px(4,12), px(6,12), px(8,12), px(10,12), px(12,12), px(14,12), px(16,12), px(18,12),
    px(4,14), px(18,14),
    px(4,16), px(18,16),
    px(4,18), px(18,18),
    px(4,20), px(6,20), px(8,20), px(10,20), px(12,20), px(14,20), px(16,20), px(18,20),
    // Lines on paper
    px(8,6), px(10,6), px(12,6), px(14,6),
    px(8,10), px(10,10), px(12,10), px(14,10),
    px(8,16), px(10,16), px(12,16),
  ];
  return <PixelIconSVG d={d} className={className} size={size} color={color} />;
}

/** 📁 文件夹 */
export function PixelFolder({ className, size, color }: PixelIconProps) {
  const d = [
    px(2,4), px(4,4), px(6,4), px(8,4), px(10,4),
    px(2,6), px(20,6),
    px(2,8), px(20,8),
    px(2,10), px(20,10),
    px(2,12), px(20,12),
    px(2,14), px(20,14),
    px(2,16), px(20,16),
    px(2,18), px(20,18),
    px(2,20), px(4,20), px(6,20), px(8,20), px(10,20), px(12,20), px(14,20), px(16,20), px(18,20), px(20,20),
    // Tab
    px(4,2), px(6,2), px(8,2),
  ];
  return <PixelIconSVG d={d} className={className} size={size} color={color} />;
}

/** 📅 日历 */
export function PixelCalendar({ className, size, color }: PixelIconProps) {
  const d = [
    px(4,2), px(6,2), px(18,2), px(20,2),
    px(4,4), px(6,4), px(18,4), px(20,4),
    px(2,6), px(4,6), px(6,6), px(8,6), px(10,6), px(12,6), px(14,6), px(16,6), px(18,6), px(20,6), px(22,6),
    px(2,8), px(22,8),
    px(2,10), px(22,10),
    px(2,12), px(22,12),
    px(2,14), px(22,14),
    px(2,16), px(22,16),
    px(2,18), px(22,18),
    px(2,20), px(4,20), px(6,20), px(8,20), px(10,20), px(12,20), px(14,20), px(16,20), px(18,20), px(20,20), px(22,20),
    // Day marker
    px(8,12), px(10,12),
    px(8,14), px(10,14),
    px(8,16), px(10,16),
  ];
  return <PixelIconSVG d={d} className={className} size={size} color={color} />;
}

/** 💬 对话气泡 */
export function PixelChat({ className, size, color }: PixelIconProps) {
  const d = [
    px(4,2), px(6,2), px(8,2), px(10,2), px(12,2), px(14,2), px(16,2), px(18,2),
    px(2,4), px(20,4),
    px(2,6), px(20,6),
    px(2,8), px(20,8),
    px(2,10), px(20,10),
    px(2,12), px(20,12),
    px(2,14), px(4,14), px(6,14), px(8,14), px(10,14), px(12,14), px(14,14), px(16,14), px(18,14), px(20,14),
    px(4,16), px(6,16), px(8,16), px(10,16),
    px(4,18), px(6,18), px(8,18),
    px(2,20), px(4,20),
    // Text lines
    px(6,6), px(8,6), px(10,6), px(12,6), px(14,6), px(16,6),
    px(6,10), px(8,10), px(10,10), px(12,10),
  ];
  return <PixelIconSVG d={d} className={className} size={size} color={color} />;
}

/** 🖼️ 图片/相册 */
export function PixelImage({ className, size, color }: PixelIconProps) {
  const d = [
    px(2,2), px(4,2), px(6,2), px(8,2), px(10,2), px(12,2), px(14,2), px(16,2), px(18,2), px(20,2),
    px(2,4), px(20,4),
    px(2,6), px(20,6),
    px(2,8), px(20,8),
    px(2,10), px(20,10),
    px(2,12), px(20,12),
    px(2,14), px(20,14),
    px(2,16), px(20,16),
    px(2,18), px(20,18),
    px(2,20), px(4,20), px(6,20), px(8,20), px(10,20), px(12,20), px(14,20), px(16,20), px(18,20), px(20,20),
    // Mountain
    px(8,14), px(10,12), px(12,10), px(14,12), px(16,14),
    // Sun
    px(16,4), px(18,4),
    px(16,6), px(18,6),
    px(14,4), px(20,4),
    px(16,2), px(18,2),
  ];
  return <PixelIconSVG d={d} className={className} size={size} color={color} />;
}

/** ⚙️ 齿轮/设置 */
export function PixelGear({ className, size, color }: PixelIconProps) {
  const d = [
    // Teeth
    px(10,0), px(12,0), px(14,0),
    px(10,2), px(12,2), px(14,2),
    px(10,22), px(12,22), px(14,22),
    px(10,24), px(12,24), px(14,24),
    px(0,10), px(2,10),
    px(0,12), px(2,12),
    px(0,14), px(2,14),
    px(22,10), px(24,10),
    px(22,12), px(24,12),
    px(22,14), px(24,14),
    // Body
    px(4,4), px(6,4), px(18,4), px(20,4),
    px(4,6), px(6,6), px(18,6), px(20,6),
    px(2,8), px(4,8), px(6,8), px(18,8), px(20,8), px(22,8),
    px(2,10), px(4,10), px(6,10), px(18,10), px(20,10), px(22,10),
    px(2,12), px(4,12), px(6,12), px(18,12), px(20,12), px(22,12),
    px(2,14), px(4,14), px(6,14), px(18,14), px(20,14), px(22,14),
    px(2,16), px(4,16), px(6,16), px(18,16), px(20,16), px(22,16),
    px(4,18), px(6,18), px(18,18), px(20,18),
    px(4,20), px(6,20), px(18,20), px(20,20),
    // Center hole
    px(8,8), px(10,8), px(12,8), px(14,8), px(16,8),
    px(8,10), px(16,10),
    px(8,12), px(16,12),
    px(8,14), px(16,14),
    px(8,16), px(10,16), px(12,16), px(14,16), px(16,16),
  ];
  return <PixelIconSVG d={d} className={className} size={size} color={color} />;
}

/** ℹ️ 信息 */
export function PixelInfo({ className, size, color }: PixelIconProps) {
  const d = [
    // Circle outline
    px(8,2), px(10,2), px(12,2), px(14,2), px(16,2),
    px(6,4), px(18,4),
    px(4,6), px(20,6),
    px(4,8), px(20,8),
    px(4,10), px(20,10),
    px(4,12), px(20,12),
    px(4,14), px(20,14),
    px(4,16), px(20,16),
    px(6,18), px(18,18),
    px(8,20), px(10,20), px(12,20), px(14,20), px(16,20),
    // Inner i
    px(10,6), px(12,6), px(14,6),
    px(10,10), px(12,10), px(14,10),
    px(10,12), px(12,12), px(14,12),
    px(10,14), px(12,14), px(14,14),
  ];
  return <PixelIconSVG d={d} className={className} size={size} color={color} />;
}

/** 🧩 拼图块/技能 */
export function PixelPuzzle({ className, size, color }: PixelIconProps) {
  const d = [
    // Top with bump
    px(8,0), px(10,0), px(12,0), px(14,0), px(16,0),
    // Left
    px(6,2), px(8,2),
    px(4,4), px(6,4),
    // Main body top
    px(8,2), px(10,2), px(14,2), px(16,2),
    // Body
    px(4,6), px(6,6), px(8,6), px(10,6), px(12,6), px(14,6), px(16,6), px(18,6), px(20,6),
    px(4,8), px(20,8),
    px(4,10), px(20,10),
    px(4,12), px(20,12),
    px(4,14), px(6,14), px(8,14), px(10,14), px(12,14), px(14,14), px(16,14), px(18,14), px(20,14),
    // Bottom bump
    px(6,16), px(8,16), px(16,16), px(18,16),
    px(4,18), px(6,18), px(18,18), px(20,18),
    px(4,20), px(6,20), px(8,20), px(16,20), px(18,20), px(20,20),
    px(8,22), px(10,22), px(12,22), px(14,22), px(16,22),
  ];
  return <PixelIconSVG d={d} className={className} size={size} color={color} />;
}

/** 🔌 插件/连接 */
export function PixelPlug({ className, size, color }: PixelIconProps) {
  const d = [
    // Prongs
    px(8,0), px(10,0),
    px(8,2), px(10,2),
    px(14,0), px(16,0),
    px(14,2), px(16,2),
    // Body
    px(6,4), px(8,4), px(10,4), px(12,4), px(14,4), px(16,4), px(18,4),
    px(6,6), px(8,6), px(10,6), px(12,6), px(14,6), px(16,6), px(18,6),
    px(6,8), px(8,8), px(10,8), px(12,8), px(14,8), px(16,8), px(18,8),
    // Bottom
    px(6,10), px(8,10), px(10,10), px(12,10), px(14,10), px(16,10), px(18,10),
    px(8,12), px(10,12), px(12,12), px(14,12), px(16,12),
    px(8,14), px(16,14),
    // Cord
    px(10,16), px(12,16), px(14,16),
    px(10,18), px(12,18), px(14,18),
    px(10,20), px(14,20),
    px(8,22), px(16,22),
  ];
  return <PixelIconSVG d={d} className={className} size={size} color={color} />;
}

/** ⭐ 星星 */
export function PixelStar({ className, size, color }: PixelIconProps) {
  const d = [
    px(10,0), px(12,0), px(14,0),
    px(10,2), px(12,2), px(14,2),
    px(10,4), px(12,4), px(14,4),
    px(6,6), px(8,6), px(10,6), px(12,6), px(14,6), px(16,6), px(18,6),
    px(4,8), px(6,8), px(8,8), px(10,8), px(12,8), px(14,8), px(16,8), px(18,8), px(20,8),
    px(2,10), px(4,10), px(6,10), px(8,10), px(10,10), px(12,10), px(14,10), px(16,10), px(18,10), px(20,10), px(22,10),
    // Lower star
    px(6,12), px(8,12), px(10,12), px(12,12), px(14,12), px(16,12), px(18,12),
    px(8,14), px(10,14), px(12,14), px(14,14), px(16,14),
    px(8,16), px(10,16), px(12,16), px(14,16), px(16,16),
    px(6,18), px(8,18), px(18,18), px(20,18),
    px(4,20), px(6,20), px(20,20), px(22,20),
    px(2,22), px(4,22), px(22,22), px(24,22),
  ];
  return <PixelIconSVG d={d} className={className} size={size} color={color} />;
}

// ============================================================================
// Icon Registry - name to component mapping
// ============================================================================

export const PIXEL_ICONS: Record<string, React.ComponentType<PixelIconProps>> = {
  'clipboard': PixelClipboard,
  'web': PixelWeb,
  'search': PixelSearch,
  'robot': PixelRobot,
  'mask': PixelMask,
  'lightning': PixelLightning,
  'plus': PixelPlus,
  'note': PixelNote,
  'folder': PixelFolder,
  'calendar': PixelCalendar,
  'chat': PixelChat,
  'image': PixelImage,
  'gear': PixelGear,
  'info': PixelInfo,
  'puzzle': PixelPuzzle,
  'plug': PixelPlug,
  'star': PixelStar,
};

// ============================================================================
// Emoji to pixel icon mapping
// ============================================================================

export const EMOJI_TO_PIXEL: Record<string, string> = {
  '📋': 'clipboard',
  '🕸️': 'web',
  '🔍': 'search',
  '🤖': 'robot',
  '🎭': 'mask',
  '⚡': 'lightning',
  '➕': 'plus',
  '📝': 'note',
  '📁': 'folder',
  '📅': 'calendar',
  '💬': 'chat',
  '🖼️': 'image',
  '⚙️': 'gear',
  'ℹ️': 'info',
  '🧩': 'puzzle',
  '🔌': 'plug',
  '⭐': 'star',
  '📂': 'folder',
  '📊': 'clipboard',
  '🔧': 'gear',
  '🔨': 'gear',
  '💡': 'info',
  '🎯': 'search',
  '✨': 'star',
  '🌟': 'star',
};

/**
 * Convert emoji string to pixel SVG icon component
 * Returns the emoji unchanged if no pixel icon mapping exists
 */
export function emojiToPixelIcon(emoji: string, size: number = 32, color?: string): React.ReactNode {
  const pixelKey = EMOJI_TO_PIXEL[emoji];
  if (!pixelKey) return emoji;

  const IconComponent = PIXEL_ICONS[pixelKey];
  if (!IconComponent) return emoji;

  return <IconComponent size={size} color={color} />;
}

/**
 * PixelIcon component - renders emoji as pixel SVG or falls back to text
 * Usage: <PixelIcon emoji="🤖" size={32} />
 */
export function PixelIcon({ emoji, size = 32, className: _className, color }: {
  emoji: string;
  size?: number;
  className?: string;
  color?: string;
}) {
  return <>{emojiToPixelIcon(emoji, size, color)}</>;
}
