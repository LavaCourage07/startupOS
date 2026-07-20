'use client';

import * as React from 'react';
import { CalendarClock } from 'lucide-react';
import { ScheduleDialog } from './ScheduleDialog';

export function ScheduleButton() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        title="定时任务"
        aria-label="定时任务"
      >
        <CalendarClock className="h-4 w-4" />
      </button>
      <ScheduleDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
