import { describe, expect, it } from 'vitest';
import type { DockApp } from '@originos/core/types';
import { dedupeDockApps } from '@/store/dockStore';

function dockApp(app: Partial<DockApp> & Pick<DockApp, 'id' | 'name'>): DockApp {
  return {
    icon: '•',
    iconType: 'emoji',
    isRunning: false,
    isPinned: true,
    index: 0,
    appType: 'action',
    ...app,
  };
}

describe('dedupeDockApps', () => {
  it('deduplicates apps by id and skillName while preserving first occurrence order', () => {
    const result = dedupeDockApps([
      dockApp({ id: 'skill-old-role', name: '创建角色旧入口', appType: 'skill', skillName: 'role-agent-creator' }),
      dockApp({ id: 'app-workspace', name: '工作区' }),
      dockApp({ id: 'app-workspace', name: '工作区重复' }),
      dockApp({ id: 'skill-role-agent-creator', name: '创建角色新入口', appType: 'skill', skillName: 'role-agent-creator' }),
      dockApp({ id: 'app-project-create', name: '创建项目' }),
    ]);

    expect(result.map((app) => app.id)).toEqual([
      'skill-old-role',
      'app-workspace',
      'app-project-create',
    ]);
    expect(result.map((app) => app.index)).toEqual([0, 1, 2]);
  });
});
