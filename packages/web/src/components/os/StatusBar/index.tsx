/**
 * StatusBar Component - 顶部状态栏
 */

import { StatusBarProps } from '@originos/core/types';
import Clock from './Clock';
import NetworkStatus from './NetworkStatus';
import { ScheduleButton } from '../schedules';

export default function StatusBar({ showNetwork = true }: StatusBarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-8 px-4 flex items-center justify-between bg-black/20 backdrop-blur-md border-b border-white/10">
      <div className="flex items-center gap-4">
        <span className="text-xs font-semibold text-white/80">OriginOS</span>
      </div>
      <div className="flex items-center gap-4">
        <ScheduleButton />
        {showNetwork && <NetworkStatus />}
        <Clock />
      </div>
    </div>
  );
}
