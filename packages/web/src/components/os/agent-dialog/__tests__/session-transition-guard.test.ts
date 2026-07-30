import {
  createSessionTransitionGuard,
  shouldAutoStartSession,
} from '../session-transition-guard';

describe('Agent dialog session transition guard', () => {
  it('rejects init A after restore B becomes the current target', () => {
    const guard = createSessionTransitionGuard();
    const initA = guard.begin('initialize:session-a');
    const restoreB = guard.begin('restore:session-b');

    expect(guard.isCurrent(initA)).toBe(false);
    expect(guard.isCurrent(restoreB)).toBe(true);
  });

  it('invalidates an in-flight initialization before restore starts', () => {
    const guard = createSessionTransitionGuard();
    const initA = guard.begin('initialize:session-a');

    guard.invalidate();

    expect(guard.isCurrent(initA)).toBe(false);
  });

  it.each([
    { isRestoring: true, switchingSessionId: null },
    { isRestoring: false, switchingSessionId: 'session-new' },
  ])('does not consume welcome state during a session transition', (transition) => {
    expect(shouldAutoStartSession({
      isInitialized: true,
      hasAutoStarted: false,
      messageCount: 0,
      isThinking: false,
      ...transition,
    })).toBe(false);
  });

  it('allows welcome after new-session initialization clears the transition', () => {
    expect(shouldAutoStartSession({
      isInitialized: true,
      isRestoring: false,
      switchingSessionId: null,
      hasAutoStarted: false,
      messageCount: 0,
      isThinking: false,
    })).toBe(true);
  });
});
