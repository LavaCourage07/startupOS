#!/usr/bin/env node

/**
 * 集成测试：数字化交付设备审查项目的多 Agent 协作流程
 *
 * 测试目标：
 * 1. 验证 Supervisor 能够持续迭代的派发所有 7 个 agent
 * 2. 验证 HITL 正确接入（worker ask_user_question 等待用户回答）
 * 3. 验证 Blackboard 包含 upstream$<agentId>$output
 * 4. 验证 DAG 任务持久化到 Blackboard（swarm$tasks$*）
 *
 * 执行方式：node scripts/test-collaboration-flow.js
 */

import { executeSupervisorDag } from './src/lib/collaboration-runtime-bridge/multi-agent-executor.js';
import { FSEventStore } from './src/modules/collaboration-runtime/session/fs-event-store.js';

const TEST_CONFIG = {
  projectId: 'proj-1778321075425-gmv0zt4h8',
  globalGoal: '完成抚顺石化项目的数字化交付设备审查流程',
  sessionId: `test-collab-${Date.now()}`,
};

console.log('='.repeat(60));
console.log('数字化交付设备审查项目 - 多 Agent 协作集成测试');
console.log('='.repeat(60));

async function runTest() {
  const startTime = Date.now();

  // 初始化事件存储
  const sessionDir = `data/projects/${TEST_CONFIG.projectId}/collaboration-sessions/${TEST_CONFIG.sessionId}`;
  const eventStore = new FSEventStore(TEST_CONFIG.sessionId, sessionDir);

  // 模拟 SSE 事件发射器（收集事件）
  const events = [];
  const eventEmitter = {
    emit: (event) => {
      events.push(event);
      console.log(`[${event.type}] ${event.source ?? 'system'}`);
    },
  };

  try {
    console.log('\n[1] 启动 Supervisor DAG 执行...');
    console.log(`    项目 ID: ${TEST_CONFIG.projectId}`);
    console.log(`    会话 ID: ${TEST_CONFIG.sessionId}`);
    console.log(`    全局目标: ${TEST_CONFIG.globalGoal}`);

    const result = await executeSupervisorDag(
      TEST_CONFIG,
      eventStore,
      eventEmitter
    );

    const duration = Date.now() - startTime;

    console.log('\n[2] 执行结果汇总:');
    console.log(`    状态: ${result.status}`);
    console.log(`    完成 Agent 数: ${result.completedAgents.length}`);
    console.log(`    失败 Agent 数: ${result.failedAgents.length}`);
    console.log(`    总耗时: ${(duration / 1000).toFixed(2)}秒`);

    console.log('\n[3] 完成的 Agents:');
    result.completedAgents.forEach(agentId => {
      console.log(`    ✓ ${agentId}`);
    });

    if (result.failedAgents.length > 0) {
      console.log('\n[4] 失败的 Agents:');
      result.failedAgents.forEach(agentId => {
        console.log(`    ✗ ${agentId}`);
      });
    }

    console.log('\n[5] 事件统计:');
    const eventStats = {};
    events.forEach(evt => {
      eventStats[evt.type] = (eventStats[evt.type] || 0) + 1;
    });
    Object.entries(eventStats)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`    ${type}: ${count}`);
      });

    // 验证检查点
    console.log('\n[6] 验证检查点:');

    // P0: 验证所有 7 个 agent 至少启动/派发
    const expectedAgents = [
      'project-config',
      'design-data-import',
      'review-task-manager',
      'naming-reviewer',
      'property-fill-reviewer',
      'three-d-consistency-reviewer',
      'report-generator',
    ];
    const startedAgents = new Set(
      events
        .filter(e => e.type === 'AGENT_START')
        .map(e => e.payload?.['agentId'])
    );
    const allStarted = expectedAgents.every(id => startedAgents.has(id));
    console.log(`    P0: 所有 7 个 agent 已启动 - ${allStarted ? '通过 ✓' : '失败 ✗'}`);

    // P0: 验证 SUPERVISOR_TOOL_CALL ≥ DAG 节点数
    const toolCallCount = events.filter(e => e.type === 'SUPERVISOR_TOOL_CALL').length;
    const sufficientCalls = toolCallCount >= expectedAgents.length;
    console.log(`    P0: SUPERVISOR_TOOL_CALL ≥ 7 (实际 ${toolCallCount}) - ${sufficientCalls ? '通过 ✓' : '失败 ✗'}`);

    // P0: 验证 Blackboard 包含 upstream$<agentId>$output
    const { Blackboard } = await import('./src/modules/collaboration-runtime/session/blackboard.js');
    const bb = await Blackboard.loadSnapshot(TEST_CONFIG.sessionId, sessionDir);
    const upstreamKeys = bb.getEntries()
      .map(e => e.key)
      .filter(key => key.startsWith('upstream$') && key.endsWith('$output'));
    const hasUpstream = upstreamKeys.length > 0;
    console.log(`    P0: Blackboard 包含 upstream$<agentId>$output (${upstreamKeys.length}条) - ${hasUpstream ? '通过 ✓' : '失败 ✗'}`);

    // P2: 验证 swarm$tasks$* 持久化
    const taskKeys = bb.getEntries()
      .map(e => e.key)
      .filter(key => key.startsWith('swarm$tasks$'));
    const hasTasks = taskKeys.length > 0;
    console.log(`    P2: Blackboard 包含 swarm$tasks$* (${taskKeys.length}条) - ${hasTasks ? '通过 ✓' : '失败 ✗'}`);

    // P1: 验证 HITL 链路（检查是否有 HUMAN_REVIEW_REQUEST 事件且未被 mock）
    const hitlEvents = events.filter(e => e.type === 'HUMAN_REVIEW_REQUEST');
    console.log(`    P1: HITL 事件 (${hitlEvents.length}条) - ${hitlEvents.length > 0 ? '有' : '无'}`);

    console.log('\n[7] 详细事件时间线:');
    events
      .filter(e => ['SUPERVISOR_TOOL_CALL', 'AGENT_START', 'AGENT_END', 'SUPERVISOR_WORKER_COMPLETE'].includes(e.type))
      .forEach(e => {
        const time = new Date(e.timestamp).toLocaleTimeString();
        const payloadSummary = e.payload
          ? Object.entries(e.payload)
              .filter(([k]) => ['workerId', 'toolName', 'agentId'].includes(k))
              .map(([k, v]) => `${k}=${v}`)
              .join(', ')
          : '';
        console.log(`    [${time}] ${e.type} ${payloadSummary}`);
      });

  } catch (error) {
    console.error('\n[错误] 测试执行失败:', error);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('测试完成');
  console.log('='.repeat(60));
}

// 执行测试
runTest().catch(console.error);
