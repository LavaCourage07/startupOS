#!/usr/bin/env bash
# Supervisor Agent 执行监控测试
# Usage: bash scripts/test-supervisor-execution.sh
#
# 监控内容：
# 1. 创建协作会话
# 2. 执行会话（Supervisor 模式）
# 3. 实时监控 collaboration-sessions 目录的事件流和文件变化

set -euo pipefail

PROJECT_ID="proj-1778321075425-gmv0zt4h8"
BASE_URL="http://localhost:3000/api/collaboration"
SESSIONS_DIR="data/projects/${PROJECT_ID}/collaboration-sessions"

echo "========== 拓扑分析 =========="
echo "检查 agents.json 协作边..."

# 收集所有 edges
edges=$(cat "data/projects/${PROJECT_ID}/solutions/v1.1/agents.json" | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
agents = data['agents']
print(f'Agent 数量: {len(agents)}')
for a in agents:
    collab_types = [c['type'] for c in a.get('collaborations', [])]
    print(f'  - {a[\"id\"]} ({a[\"name\"]}): {collab_types or \"none\"}')

edges = []
for a in agents:
    for c in a.get('collaborations', []):
        edges.append({'from': a['id'], 'to': c['targetAgentId'], 'type': c['type']})

print(f'\n边列表 ({len(edges)} 条):')
for e in edges:
    print(f'  {e[\"from\"]} -> {e[\"to\"]} ({e[\"type\"]})')

has_notify = any(e['type'] == 'notify' for e in edges)
has_self_loop = any(e['from'] == e['to'] for e in edges)
mode = 'system' if has_notify or has_self_loop else 'workflow'
print(f'\nmode-router 预测: \"{mode}\"')
print(f'  - 有 notify 边: {has_notify}')
print(f'  - 有 self-loop: {has_self_loop}')
")

echo "$edges"
echo "================================\n"

# ============================================================================
# Step 1: Create session
# ============================================================================
echo "========== 创建协作会话 =========="
CREATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/sessions" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\": \"${PROJECT_ID}\", \"globalGoal\": \"完成设计审查全流程\", \"mode\": \"system\"}")

echo "创建响应: ${CREATE_RESPONSE}"
SESSION_ID=$(echo "${CREATE_RESPONSE}" | python3 -c "import json, sys; data=json.load(sys.stdin); print(data.get('id', 'N/A'))")
echo "Session ID: ${SESSION_ID}"
echo "================================\n"

if [ "${SESSION_ID}" = "N/A" ]; then
    echo "ERROR: Failed to create session"
    echo "Response: ${CREATE_RESPONSE}"
    exit 1
fi

# ============================================================================
# Step 2: Start monitoring the session directory
# ============================================================================
echo "========== 开始监控会话文件 =========="
SNAPSHOT_BEFORE=$(ls -la "${SESSIONS_DIR}/${SESSION_ID}/" 2>/dev/null || echo "empty")
echo "会话初始文件:"
echo "${SNAPSHOT_BEFORE}"
echo "================================\n"

# ============================================================================
# Step 3: Execute the session (triggers Supervisor)
# ============================================================================
echo "========== 执行会话 =========="
EXEC_RESPONSE=$(curl -s -X POST "${BASE_URL}/sessions/${SESSION_ID}/execute")
echo "执行响应: ${EXEC_RESPONSE}"
echo ""

# ============================================================================
# Step 4: Monitor event log over time
# ============================================================================
echo "========== 实时监控事件流 =========="

EVENT_FILE="${SESSIONS_DIR}/${SESSION_ID}/events.jsonl"

for i in $(seq 1 30); do
    sleep 5

    # Count events
    if [ -f "${EVENT_FILE}" ]; then
        EVENT_COUNT=$(wc -l < "${EVENT_FILE}" 2>/dev/null || echo 0)
        echo ""
        echo "--- 第 ${i} 次检查 (${EVENT_COUNT} 个事件) ---"

        # Show recent events
        tail -5 "${EVENT_FILE}" 2>/dev/null | while IFS= read -r line; do
            TYPE=$(echo "$line" | python3 -c "import json,sys; print(json.loads(sys.stdin)['type'])" 2>/dev/null || echo "parse_error")
            SOURCE=$(echo "$line" | python3 -c "import json,sys; print(json.loads(sys.stdin)['source'])" 2>/dev/null || echo "?")
            echo "  ${SOURCE}: ${TYPE}"
        done

        # Check for key events
        SUPERVISOR_START=$(grep -c "SUPERVISOR_AGENT_START" "${EVENT_FILE}" 2>/dev/null || echo 0)
        SUPERVISOR_TOOL_CALLS=$(grep -c "SUPERVISOR_TOOL_CALL" "${EVENT_FILE}" 2>/dev/null || echo 0)
        AGENT_THINKING=$(grep -c "AGENT_THINKING" "${EVENT_FILE}" 2>/dev/null || echo 0)
        SUPERVISOR_WORKER_COMPLETE=$(grep -c "SUPERVISOR_WORKER_COMPLETE" "${EVENT_FILE}" 2>/dev/null || echo 0)
        AGENT_END=$(grep -c "AGENT_END" "${EVENT_FILE}" 2>/dev/null || echo 0)

        echo "  关键事件计数:"
        echo "    SUPERVISOR_AGENT_START: ${SUPERVISOR_START}"
        echo "    SUPERVISOR_TOOL_CALL: ${SUPERVISOR_TOOL_CALLS}"
        echo "    SUPERVISOR_WORKER_COMPLETE: ${SUPERVISOR_WORKER_COMPLETE}"
        echo "    AGENT_THINKING: ${AGENT_THINKING}"
        echo "    AGENT_END: ${AGENT_END}"

        # If session completed, stop monitoring
        SESSION_STATUS=$(curl -s "${BASE_URL}/sessions/${SESSION_ID}" 2>/dev/null | python3 -c "import json,sys; print(json.loads(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unknown")
        echo "  会话状态: ${SESSION_STATUS}"

        if [ "${SESSION_STATUS}" = "completed" ] || [ "${SESSION_STATUS}" = "aborted" ] || [ "${SESSION_STATUS}" = "terminated" ]; then
            echo "  会话已结束，停止监控"
            break
        fi

        # If we have at least 50 events and supervisor has dispatched, likely done enough for analysis
        if [ "${EVENT_COUNT}" -gt 50 ] && [ "${SUPERVISOR_TOOL_CALLS}" -gt 0 ]; then
            echo "  已有足够事件，停止监控"
            break
        fi
    else
        echo "--- 第 ${i} 次检查: 事件文件尚未生成 ---"
    fi
done

echo ""
echo "================================"

# ============================================================================
# Step 5: Final diagnosis
# ============================================================================
echo "\n========== 最终诊断 =========="

if [ -f "${EVENT_FILE}" ]; then
    EVENT_COUNT=$(wc -l < "${EVENT_FILE}")
    echo "总事件数: ${EVENT_COUNT}"

    echo "\n完整事件流:"
    python3 -c "
import json

with open('${EVENT_FILE}') as f:
    events = [json.loads(line) for line in f]

print(f'{'序号':<5} {'时间':<28} {'来源':<30} {'事件类型':<30} {'摘要'}')
print('-' * 150)

for i, e in enumerate(events):
    ts = e['timestamp'][:23]
    source = str(e['source'])[:28]
    etype = str(e['type'])[:28]
    payload = str(e.get('payload', ''))[:60]
    print(f'{i+1:<5} {ts:<28} {source:<30} {etype:<30} {payload}')

# Summary
print(f'\n关键事件统计:')
from collections import Counter
types = Counter(e['type'] for e in events)
for t, c in sorted(types.items(), key=lambda x: -x[1]):
    print(f'  {t}: {c}')
"
else
    echo "事件文件不存在: ${EVENT_FILE}"
fi

# Check session files
echo "\n会话目录文件:"
ls -la "${SESSIONS_DIR}/${SESSION_ID}/" 2>/dev/null || echo "目录不存在"

# Check supervisor directory
echo "\nSupervisor 工作目录文件:"
ls -la "data/agents/supervisor/" 2>/dev/null || echo "目录不存在"

# Check agent working directories
echo "\nAgent 工作目录:"
ls -d "data/projects/${PROJECT_ID}/agents/"* 2>/dev/null || echo "无 Agent 目录"

echo "\n================================"
echo "测试完成。Session ID: ${SESSION_ID}"
