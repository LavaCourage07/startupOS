export interface SessionTransitionToken {
  epoch: number;
  target: string;
}

export interface SessionTransitionGuard {
  begin: (target: string) => SessionTransitionToken;
  invalidate: () => void;
  isCurrent: (token: SessionTransitionToken) => boolean;
}

export interface SessionAutoStartState {
  isInitialized: boolean;
  isRestoring: boolean;
  switchingSessionId: string | null;
  hasAutoStarted: boolean;
  messageCount: number;
  isThinking: boolean;
}

export function shouldAutoStartSession(state: SessionAutoStartState): boolean {
  return state.isInitialized
    && !state.isRestoring
    && !state.switchingSessionId
    && !state.hasAutoStarted
    && state.messageCount === 0
    && !state.isThinking;
}

export function createSessionTransitionGuard(): SessionTransitionGuard {
  let epoch = 0;
  let target: string | null = null;

  return {
    begin(nextTarget) {
      epoch += 1;
      target = nextTarget;
      return { epoch, target: nextTarget };
    },
    invalidate() {
      epoch += 1;
      target = null;
    },
    isCurrent(token) {
      return token.epoch === epoch && token.target === target;
    },
  };
}
