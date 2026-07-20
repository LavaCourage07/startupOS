/**
 * Ambient type declarations for missing packages
 */

declare module "@mariozechner/pi-coding-agent" {
  export interface AgentSession {
    id: string;
    messages: unknown[];
    systemPrompt: string;
  }
}
