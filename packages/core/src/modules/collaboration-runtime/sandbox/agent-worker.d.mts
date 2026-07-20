/**
 * Agent Worker — 子进程入口点。
 *
 * Story 9.6: PI Agent 桥接与子进程入口
 *
 * 通过 stdio JSON Line 协议与 Runtime 通信：
 * - 接收 Runtime 命令（initialize / prompt / abort / shutdown）
 * - 输出 RuntimeEvent 到 stdout
 *
 * 子进程内完整运行：
 * 1. 读取 Agent.md / Tool.md / Skill.md
 * 2. 构建 system prompt（7 层或 OpenClaw 风格）
 * 3. 创建 PersistentAgent / OriginOSAgent
 * 4. 执行 agent loop（prompt → tool_call → tool_result → loop）
 * 5. CognitiveManager hooks 在子进程内运行
 *
 * 运行方式: npx tsx agent-worker.mts
 * 环境变量: AGENT_PROJECT_ID, AGENT_ID, AGENT_WORKING_DIR
 */
export {};
//# sourceMappingURL=agent-worker.d.mts.map