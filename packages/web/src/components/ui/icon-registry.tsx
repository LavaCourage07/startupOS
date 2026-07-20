/**
 * 图标注册表 - 从 src/styles/icon/ 导入 SVG 图标
 *
 * 文件 → emoji 映射:
 *  a-chilunpixel     → ⚙️ 本体编辑器
 *  a-fangdajingpixel → 🔍 搜索
 *  a-jiangbeipixel   → 🕸️ 面具/本体
 *  a-rilipixel       → 📅 日历
 *  a-shandianpixel   → ⚡ 闪电
 *  wodeshijie        → 🎭 我的角色 (蘑菇)
 *  xiangsu_youxiji   → 🎮 创建项目
 *  xinfengpixel      → 💬 我的项目 (信封)
 */

// Import SVGs as URL strings (handled by webpack asset/resource)
import iconGear from '@/styles/icon/a-chilunpixel_huaban1.svg';
import iconSearch from '@/styles/icon/a-fangdajingpixel_huaban1.svg';
import iconMask from '@/styles/icon/a-jiangbeipixel_huaban1.svg';
import iconCalendar from '@/styles/icon/a-rilipixel_huaban1.svg';
import iconLightning from '@/styles/icon/a-shandianpixel_huaban1.svg';
import iconMogu from '@/styles/icon/a-mogu.svg';
import iconWorld from '@/styles/icon/wodeshijie.svg';
import iconGame from '@/styles/icon/xiangsu_youxiji.svg';
import iconChat from '@/styles/icon/xinfengpixel.svg';

// Icon registry: emoji -> SVG URL
const ICON_MAP: Record<string, string> = {
  '⚙️': iconGear,
  '🔍': iconSearch,
  '🕸️': iconMask,
  '📅': iconCalendar,
  '⚡': iconLightning,
  '🎭': iconWorld,
  '🌍': iconMogu,
  '🎮': iconGame,
  '💬': iconChat,
  // Dock shortcuts
  '➕': iconGame,    // 创建项目
  '📝': iconChat,   // 工作区
  '🤖': iconGear,   // 创建 Agent
};

/**
 * Resolve an emoji to an SVG URL. Returns null if not found.
 */
export function resolveSvgIcon(icon: string): string | null {
  return ICON_MAP[icon] ?? null;
}

/**
 * AppIcon - renders SVG icon via <img>, falls back to emoji text
 */
export function AppIcon({ emoji, size = 28, className }: {
  emoji: string;
  size?: number;
  className?: string;
}) {
  const svgUrl = ICON_MAP[emoji];
  if (svgUrl) {
    return (
      <img
        src={svgUrl}
        alt={emoji}
        width={size}
        height={size}
        className={`object-contain ${className ?? ''}`}
        style={{ imageRendering: 'pixelated', width: `${size}px`, height: `${size}px` }}
      />
    );
  }
  return <span className={`select-none ${className ?? ''}`} style={{ fontSize: size }}>{emoji}</span>;
}
