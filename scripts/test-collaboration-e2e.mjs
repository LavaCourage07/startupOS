/**
 * 数字化交付设备审查项目 - 多 Agent 协作集成测试
 *
 * 基于 Story 9.36 修复验证的端到端测试
 * 覆盖：Supervisor 迭代循环 + HITL + Blackboard 一致性
 */

const PROJECT_ID = 'proj-1778321075425-gmv0zt4h8';
const API_BASE = 'http://localhost:3000';

// ============================================================================
// 测试场景定义
// ============================================================================

const TEST_SCENARIOS = [
  {
    name: '完整流程：无 HITL 场景',
    description: '验证 7 个 agent 能够按 DAG 顺序完整执行，无需人工介入',
    globalGoal: '完成抚顺石化项目的数字化交付设备审查流程',
    expectedAgents: [
      'project-config',
      'design-data-import',
      'review-task-manager',
      'naming-reviewer',
      'property-fill-reviewer',
      'three-d-consistency-reviewer',
      'report-generator',
    ],
    validations: {
      allAgentsStarted: true,
      supervisorToolCallCount: 7,
      blackboardHasUpstream: true,
      blackboardHasTasks: true,
    },
  },
];

// ============================================================================
// 测试执行器
// ============================================================================

class CollaborationTestRunner {
  constructor() {
    this.sessionId = null;
    this.events = [];
  }

  async createSession(mode = 'system') {
    console.log(`\n[Step 1] 创建协作会话 (${mode} 模式)...`);

    const createRes = await fetch(`${API_BASE}/api/collaboration/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: PROJECT_ID,
        mode: mode,
        timeoutMs: 120000,
        maxIterations: 50,
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`创建会话失败: ${err.error}`);
    }

    const session = await createRes.json();
    this.sessionId = session.id;
    console.log(`    ✓ 会话 ID: ${this.sessionId}`);
    console.log(`    ✓ 项目 ID: ${PROJECT_ID}`);
    console.log(`    ✓ 初始状态: ${session.status}`);

    return session;
  }

  async executeSession(globalGoal) {
    if (!this.sessionId) throw new Error('会话未创建');

    console.log(`\n[Step 2] 执行协作会话...`);

    if (globalGoal) {
      const messageRes = await fetch(`${API_BASE}/api/collaboration/sessions/${this.sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'supervisor',
          message: globalGoal,
        }),
      });

      if (!messageRes.ok) {
        const err = await messageRes.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`发送消息失败: ${err.error}`);
      }
      console.log(`    ✓ 全局目标已发送`);
    } else {
      const execRes = await fetch(`${API_BASE}/api/collaboration/sessions/${this.sessionId}/execute`, {
        method: 'POST',
      });

      if (!execRes.ok) {
        const err = await execRes.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`执行会话失败: ${err.error}`);
      }
      const result = await execRes.json();
      console.log(`    ✓ 执行状态: ${result.status}`);
    }
  }

  async collectEvents(timeoutMs = 180000) {
    if (!this.sessionId) throw new Error('会话未创建');

    console.log(`\n[Step 3] 收集事件流...`);

    const eventsRes = await fetch(`${API_BASE}/api/collaboration/sessions/${this.sessionId}/events`);
    if (eventsRes.ok) {
      this.events = await eventsRes.json();
      console.log(`    ✓ 加载历史事件: ${this.events.length} 条`);
    }

    const startTime = Date.now();
    let lastCount = this.events.length;
    let stableCount = 0;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 3000));

      const eventsRes = await fetch(`${API_BASE}/api/collaboration/sessions/${this.sessionId}/events`);
      if (eventsRes.ok) {
        const newEvents = await eventsRes.json();
        this.events = newEvents;

        const currentCount = this.events.length;
        if (currentCount === lastCount) {
          stableCount++;
          if (stableCount >= 15) {
            console.log(`    ✓ 事件流稳定 (15 次检查无变化，共 ${currentCount} 条事件)`);
            break;
          }
        } else {
          stableCount = 0;
          lastCount = currentCount;
          console.log(`    [更新] 事件数量: ${currentCount}`);
        }

        const lastEvent = this.events[this.events.length - 1];
        if (lastEvent?.type === 'SESSION_END' ||
            lastEvent?.type === 'DAG_COMPLETE' ||
            (lastEvent?.type === 'SUPERVISOR_AGGREGATE' && lastEvent.payload?.state === 'completed')) {
          console.log(`    ✓ 检测到完成事件: ${lastEvent.type}`);
          break;
        }
      }
    }
  }

  async validateScenario(scenario) {
    console.log(`\n[Step 4] 验证测试场景: ${scenario.name}`);

    const results = {};

    // 验证 1: 所有 agent 已启动
    if (scenario.validations.allAgentsStarted) {
      const startedAgents = new Set(
        this.events
          .filter(e => e.type === 'AGENT_START')
          .map(e => e.payload?.agentId)
      );
      const allStarted = scenario.expectedAgents.every(id => startedAgents.has(id));
      results['allAgentsStarted'] = {
        pass: allStarted,
        actual: `已启动: ${Array.from(startedAgents).join(', ')} | 预期: ${scenario.expectedAgents.join(', ')}`,
      };
    }

    // 验证 2: SUPERVISOR_TOOL_CALL 数量
    if (scenario.validations.supervisorToolCallCount) {
      const toolCallEvents = this.events.filter(e => e.type === 'SUPERVISOR_TOOL_CALL');
      const expectedCount = scenario.validations.supervisorToolCallCount;
      const actualCount = toolCallEvents.length;
      results['supervisorToolCallCount'] = {
        pass: actualCount >= expectedCount,
        actual: `${actualCount} >= ${expectedCount}`,
      };
    }

    // 验证 3: Blackboard 包含 upstream$<agentId>$output
    if (scenario.validations.blackboardHasUpstream) {
      try {
        const bbRes = await fetch(`${API_BASE}/api/collaboration/sessions/${this.sessionId}/blackboard`);
        if (bbRes.ok) {
          const blackboard = await bbRes.json();
          const upstreamKeys = Object.keys(blackboard.sharedData || {})
            .filter(key => key.startsWith('upstream$') && key.endsWith('$output'));
          results['blackboardHasUpstream'] = {
            pass: upstreamKeys.length > 0,
            actual: `${upstreamKeys.length} 条 upstream$<agentId>$output`,
          };
        }
      } catch (e) {
        results['blackboardHasUpstream'] = { pass: false, actual: `获取失败: ${e}` };
      }
    }

    // 验证 4: Blackboard 包含 swarm$tasks$*
    if (scenario.validations.blackboardHasTasks) {
      try {
        const bbRes = await fetch(`${API_BASE}/api/collaboration/sessions/${this.sessionId}/blackboard`);
        if (bbRes.ok) {
          const blackboard = await bbRes.json();
          const taskKeys = Object.keys(blackboard.tasks || {});
          results['blackboardHasTasks'] = {
            pass: taskKeys.length > 0,
            actual: `${taskKeys.length} 条 swarm$tasks$*`,
          };
        }
      } catch (e) {
        results['blackboardHasTasks'] = { pass: false, actual: `获取失败: ${e}` };
      }
    }

    console.log('\n    验证结果:');
    Object.entries(results).forEach(([key, { pass, actual }]) => {
      const icon = pass ? '✓' : '✗';
      console.log(`      ${icon} ${key}: ${actual}`);
    });

    const allPass = Object.values(results).every(r => r.pass);
    return { pass: allPass, results };
  }

  printEventTimeline() {
    console.log('\n[Step 5] 事件时间线:');
    const keyEvents = this.events.filter(e => [
      'AGENT_START',
      'AGENT_END',
      'SUPERVISOR_TOOL_CALL',
      'SUPERVISOR_WORKER_COMPLETE',
      'SUPERVISOR_WORKER_FAILED',
      'SESSION_END',
      'DAG_COMPLETE',
      'SUPERVISOR_AGGREGATE',
    ].includes(e.type));

    keyEvents.slice(0, 60).forEach(event => {
      const time = new Date(event.timestamp).toLocaleTimeString();
      const payloadInfo = event.payload
        ? Object.entries(event.payload)
            .filter(([k]) => ['workerId', 'toolName', 'agentId', 'description'].includes(k))
            .map(([k, v]) => `${k}=${v}`)
            .join(', ')
        : '';
      console.log(`    [${time}] ${event.type} ${payloadInfo}`);
    });
  }

  async cleanup() {
    if (this.sessionId) {
      try {
        await fetch(`${API_BASE}/api/collaboration/sessions/${this.sessionId}/abort`, {
          method: 'POST',
        });
        console.log(`\n[Cleanup] 会话 ${this.sessionId} 已中止`);
      } catch (e) {
        console.error(`[Cleanup] 中止失败: ${e}`);
      }
    }
  }
}

// ============================================================================
// 主测试流程
// ============================================================================

async function runIntegrationTest() {
  console.log('='.repeat(60));
  console.log('数字化交付设备审查 - 多 Agent 协作集成测试');
  console.log('基于 Story 9.36 修复的端到端验证');
  console.log('='.repeat(60));

  const runner = new CollaborationTestRunner();
  let passedTests = 0;
  let failedTests = 0;

  try {
    // 运行场景 1：完整流程
    console.log('\n\n');
    console.log('='.repeat(60));
    console.log(`测试场景 1: ${TEST_SCENARIOS[0].name}`);
    console.log(TEST_SCENARIOS[0].description);
    console.log('='.repeat(60));

    await runner.createSession('system');
    await runner.executeSession(TEST_SCENARIOS[0].globalGoal);

    // 收集事件（6 分钟超时）
    console.log('\n[重要提示] 事件收集将运行 6 分钟，请耐心等待...');
    await runner.collectEvents(360000);

    runner.printEventTimeline();

    const result = await runner.validateScenario(TEST_SCENARIOS[0]);
    if (result.pass) {
      passedTests++;
      console.log('\n✅ 场景 1 测试通过');
    } else {
      failedTests++;
      console.log('\n❌ 场景 1 测试失败');
    }

    await runner.cleanup();

  } catch (error) {
    console.error('\n💥 测试执行出错:', error);
    failedTests++;
    await runner.cleanup();
  }

  // 测试汇总
  console.log('\n\n');
  console.log('='.repeat(60));
  console.log('测试总结');
  console.log('='.repeat(60));
  console.log(`通过: ${passedTests}`);
  console.log(`失败: ${failedTests}`);
  console.log(`总计: ${passedTests + failedTests}`);
  console.log('='.repeat(60));
}

// 检查开发服务器是否运行
async function checkDevServer() {
  try {
    const res = await fetch(`${API_BASE}/api/collaboration/topology?projectId=${PROJECT_ID}`);
    return res.ok;
  } catch (e) {
    return false;
  }
}

// 主入口
(async () => {
  console.log('\n检查开发服务器状态...');
  const serverRunning = await checkDevServer();

  if (!serverRunning) {
    console.error('❌ 开发服务器未运行！');
    console.error('   请先运行: npm run dev');
    process.exit(1);
  }

  console.log('✅ 开发服务器运行中\n');
  await runIntegrationTest();
})();
