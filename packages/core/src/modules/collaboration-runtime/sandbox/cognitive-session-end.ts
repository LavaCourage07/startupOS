export async function flushCognitiveSessionEnd(
  cognitiveManager: unknown,
  messages: unknown[],
  label: string,
): Promise<void> {
  if (!cognitiveManager || typeof (cognitiveManager as { on_session_end?: unknown }).on_session_end !== 'function') {
    return;
  }

  try {
    await (cognitiveManager as { on_session_end: (messages: unknown[]) => Promise<void> }).on_session_end(messages);
  } catch (err) {
    console.error(`[AgentWorker] ${label} cognitive on_session_end error:`, err);
  }
}
