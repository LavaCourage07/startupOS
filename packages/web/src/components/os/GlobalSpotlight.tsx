'use client';

import { usePathname } from 'next/navigation';
import Spotlight from '@/components/os/spotlight';

export default function GlobalSpotlight() {
  const pathname = usePathname();
  // Native child windows and the dedicated Dock window should not mount
  // desktop-level shortcuts/search. Each BrowserWindow has its own renderer.
  if (pathname === '/dock' || pathname === '/window') return null;
  return <Spotlight />;
}
