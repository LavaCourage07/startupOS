/**
 * Test: Supervisor 执行监控
 *
 * 监控协作会话启动时的事件流，验证：
 * 1. Supervisor 是否正常启动（SUPERVISOR_AGENT_START）
 * 2. Worker 是如何被派发的（直接启动 vs dispatch_worker）
 * 3. 事件流的完整记录
 *
 * Usage: npx tsx scripts/test-supervisor-execution.ts
 */

import { createSession, executeSession, getEvents } from "../src/modules/collaboration-runtime/facade";
import { selectExecutionMode } from "../src/modules/collaboration-runtime/engine/mode-router";
import { readFile } from "fs/promises";
import path from "path";

const TEST_PROJECT_ID = "proj-1778321075425-gmv0zt4h8";
const TEST_GLOBAL_GOAL = "完成设计审查全流程";

// ============================================================================
// Step 1: 检查 agents.json 拓扑，判断 mode-router 会选什么
// ============================================================================

async function checkTopology(): Promise<void> {
  const solutionsDir = path.join(process.cwd(), `data/projects/${TEST_PROJECT_ID}/solutions`);
  const manifestDir = path.join(solutionsDir, "v1.1");
  const agentsPath = path.join(manifestDir, "agents.json");
  const content = await readFile(agentsPath, "utf-8");
  const data = JSON.parse(content);

  console.log(`\n========== 拓扑分析 ==========`);
  console.log(`Agent 数量: ${data.agents.length}`);
  console.log(`Agent 列表:`);
  for (const agent of data.agents) {
    const collabTypes = (agent.collaborations ?? []).map((c: { type: string }) => c.type);
    console.log(`  - ${agent.id} (${agent.name}): 协作边类型 = ${collabTypes.join(", ") || "none"}`);
  }

  // 收集所有 edges
  const collaborations: Array<{ from: string; to: string; type: string }> = [];
  for (const agent of data.agents) {
    for (const collab of agent.collaborations ?? []) {
      collaborations.push({
        from: agent.id,
        to: collab.targetAgentId,
        type: collab.type,
      });
    }
  }

  console.log(`\n边列表 (${collaborations.length} 条):`);
  for (const edge of collaborations) {
    console.log(`  ${edge.from} -> ${edge.to} (${edge.type})`);
  }

  const mode = selectExecutionMode({ collaborations });
  console.log(`\nmode-router 选择: "${mode}"`);
  console.log(`  - 有 notify 边: ${collaborations.some(e => e.type === "notify")}`);
  console.log(`  - 有 self-loop: ${collaborations.some(e => e.from === e.to)}`);
  console.log(`===============================\n`);
}

// ============================================================================
// Step 2: 创建并执行会话，监控事件流
// ============================================================================

async function testSupervisorExecution(): Promise<void> {
  console.log(`\n========== 执行测试 ==========`);
  console.log(`Project: ${TEST_PROJECT_ID}`);
  console.log(`Global Goal: ${TEST_GLOBAL_GOAL}`);

  // 创建会话
  const session = await createSession({
    projectId: TEST_PROJECT_ID,
    globalGoal: TEST_GLOBAL_GOAL,
    mode: "system", // 强制走 supervisor 路径
  });
  console.log(`Session 创建: ${session.id}`);

  // 执行会话
  const execResult = await executeSession(session.id);
  console.log(`执行请求返回: ${JSON.stringify(execResult)}`);

  // 等待一段时间让 supervisor 启动和派发
  console.log(`\n等待 10 秒让 Supervisor 启动...`);
  await new Promise(resolve => setTimeout(resolve, 10_000));

  // 读取事件流
  const events = await getEvents(session.id);
  console.log(`\n========== 事件流 (${events.length} 个事件) ==========`);

  for (const event of events) {
    const ts = event.timestamp;
    const source = event.source;
    const type = event.type;
    const payloadSummary = JSON.stringify(event.payload).slice(0, 120);
    console.log(`  [${ts}] ${source.padEnd(30)} ${type.padEnd(30)} ${payloadSummary}`);
  }

  // 关键问题诊断
  console.log(`\n========== 诊断 ==========`);

  const supervisorStart = events.find(e => e.type === "SUPERVISOR_AGENT_START");
  console.log(`SUPERVISOR_AGENT_START: ${supervisorStart ? "有" : "无"}`);

  const supervisorToolCalls = events.filter(e => e.type === "SUPERVISOR_TOOL_CALL");
  console.log(`SUPERVISOR_TOOL_CALL: ${supervisorToolCalls.length} 次`);
  for (const tc of supervisorToolCalls) {
    console.log(`  tool: ${(tc.payload as any).toolName}, args: ${JSON.stringify((tc.payload as any).args).slice(0, 100)}`);
  }

  const agentStarts = events.filter(e => e.type === "AGENT_THINKING" && e.source !== "supervisor");
  console.log(`AGENT_THINKING (非 supervisor): ${agentStarts.length} 次`);
  for (const as of agentStarts) {
    console.log(`  source: ${as.source}`);
  }

  const agentEnds = events.filter(e => e.type === "AGENT_END");
  console.log(`AGENT_END: ${agentEnds.length} 次`);
  for (const ae of agentEnds) {
    console.log(`  source: ${ae.source}`);
  }

  console.log(`===============================\n`);
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  try {
    await checkTopology();
    await testSupervisorExecution();
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    // Cleanup
    process.exit(0);
  }
}

main();
