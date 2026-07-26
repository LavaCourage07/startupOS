import { describe, expect, it } from 'vitest';

import { isSkillExportAllowed } from '../skill-export-policy';

describe('isSkillExportAllowed', () => {
  it('allows user-managed skills', () => {
    expect(isSkillExportAllowed(false)).toBe(true);
  });

  it.each([true, null, undefined])(
    'hides export for system or unresolved skill metadata: %s',
    (systemManaged) => {
      expect(isSkillExportAllowed(systemManaged)).toBe(false);
    },
  );
});
