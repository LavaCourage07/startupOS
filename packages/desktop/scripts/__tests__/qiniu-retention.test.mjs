import { describe, expect, it } from 'vitest';

import retention from '../qiniu-retention.js';

const {
  artifactVersion,
  compareSemver,
  planQiniuRetention,
} = retention;

describe('Qiniu release retention', () => {
  it('recognizes only direct release artifacts under the configured prefix', () => {
    expect(artifactVersion(
      'originos-ce/updates/stable/OriginOS CE-0.1.43-x64.exe.blockmap',
      'originos-ce/updates/stable',
    )).toBe('0.1.43');
    expect(artifactVersion(
      'originos-ce/updates/stable/latest-win.yml',
      'originos-ce/updates/stable',
    )).toBeNull();
    expect(artifactVersion(
      'other/OriginOS CE-0.1.43-x64.exe',
      'originos-ce/updates/stable',
    )).toBeNull();
    expect(artifactVersion(
      'originos-ce/updates/stable/archive/OriginOS CE-0.1.1-x64.exe',
      'originos-ce/updates/stable',
    )).toBeNull();
  });

  it('sorts semantic versions including prereleases', () => {
    expect(compareSemver('0.1.43', '0.1.42')).toBeGreaterThan(0);
    expect(compareSemver('0.1.43', '0.1.43-beta.2')).toBeGreaterThan(0);
    expect(compareSemver('0.1.43-beta.10', '0.1.43-beta.2')).toBeGreaterThan(0);
  });

  it('retains the newest versions and deletes every artifact from older versions', () => {
    const items = [];
    for (let patch = 1; patch <= 12; patch += 1) {
      items.push(
        { key: `originos-ce/updates/stable/OriginOS CE-0.1.${patch}-x64.exe` },
        { key: `originos-ce/updates/stable/OriginOS CE-0.1.${patch}-x64.exe.blockmap` },
      );
    }
    items.push(
      { key: 'originos-ce/updates/stable/latest-win.yml' },
      { key: 'originos-ce/updates/stable/unrelated.bin' },
    );

    const plan = planQiniuRetention(items, {
      prefix: 'originos-ce/updates/stable',
      retainCount: 10,
    });

    expect(plan.retainedVersions).toEqual([
      '0.1.12', '0.1.11', '0.1.10', '0.1.9', '0.1.8',
      '0.1.7', '0.1.6', '0.1.5', '0.1.4', '0.1.3',
    ]);
    expect(plan.deletedVersions).toEqual(['0.1.2', '0.1.1']);
    expect(plan.deletedKeys).toHaveLength(4);
    expect(plan.deletedKeys).not.toContain('originos-ce/updates/stable/latest-win.yml');
  });

  it('rejects unsafe retention counts', () => {
    expect(() => planQiniuRetention([], {
      prefix: 'originos-ce/updates/stable',
      retainCount: 0,
    })).toThrow('positive integer');
  });
});
