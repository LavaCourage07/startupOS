"use strict";
/**
 * 状态机解析与推进（Story R.2）
 *
 * 从 Role.md 中解析角色状态机，在 turn_end 后判断是否需要状态转换，
 * 让角色在不同阶段展现不同的行为特征。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseStateMachine = parseStateMachine;
exports.determinePhase = determinePhase;
exports.checkTransition = checkTransition;
exports.applyTransition = applyTransition;
// ============================================================================
// Phase 解析
// ============================================================================
function parseStateMachine(roleMd) {
    if (!roleMd) {
        return { phases: [], transitions: [], currentPhase: 'default' };
    }
    const fm = parseFrontmatter(roleMd);
    if (!fm) {
        return { phases: [], transitions: [], currentPhase: 'default' };
    }
    const phases = [];
    if (Array.isArray(fm.phases)) {
        for (const p of fm.phases) {
            if (p && typeof p === 'object' && 'name' in p && p.name) {
                const item = p;
                phases.push({
                    name: String(item['name']),
                    behavior: String(item['behavior'] ?? ''),
                    entryCondition: String(item['entryCondition'] ?? ''),
                    exitCondition: String(item['exitCondition'] ?? ''),
                });
            }
        }
    }
    const transitions = [];
    if (Array.isArray(fm.transitions)) {
        for (const t of fm.transitions) {
            if (t && typeof t === 'object' && 'from' in t && 'to' in t && t.from && t.to) {
                const item = t;
                transitions.push({
                    from: String(item['from']),
                    to: String(item['to']),
                    condition: String(item['condition'] ?? ''),
                });
            }
        }
    }
    const cp = fm.currentPhase;
    const currentPhase = typeof cp === 'string' && cp
        ? cp
        : (phases.length > 0 ? phases[0].name : 'default');
    return { phases, transitions, currentPhase };
}
// ============================================================================
// 阶段判断
// ============================================================================
function determinePhase(stateMachine, messages) {
    if (stateMachine.phases.length === 0) {
        return stateMachine.currentPhase;
    }
    let currentPhase = stateMachine.currentPhase;
    for (const msg of messages) {
        if (msg.role !== 'assistant')
            continue;
        const content = typeof msg.content === 'string' ? msg.content : '';
        const phaseMatch = content.match(/\[PHASE:(.+?)\]/);
        if (phaseMatch?.[1]) {
            const newPhase = phaseMatch[1].trim();
            if (stateMachine.phases.some(p => p.name === newPhase)) {
                currentPhase = newPhase;
            }
        }
    }
    return currentPhase;
}
// ============================================================================
// 转换检测
// ============================================================================
function checkTransition(stateMachine, messages) {
    if (stateMachine.phases.length === 0)
        return null;
    const lastMsg = messages.filter(m => m.role === 'assistant').pop();
    if (!lastMsg)
        return null;
    const content = typeof lastMsg.content === 'string' ? lastMsg.content : '';
    const phaseMatch = content.match(/\[PHASE:(.+?)\]/);
    if (!phaseMatch?.[1])
        return null;
    const targetPhase = phaseMatch[1].trim();
    if (!stateMachine.phases.some(p => p.name === targetPhase)) {
        return null;
    }
    const fromPhase = stateMachine.currentPhase;
    if (fromPhase === targetPhase)
        return null;
    const matchingRule = stateMachine.transitions.find(t => t.from === fromPhase && t.to === targetPhase);
    return {
        triggered: true,
        from: fromPhase,
        to: targetPhase,
        reason: matchingRule?.condition ?? 'LLM 触发阶段转换',
    };
}
function applyTransition(stateMachine, newPhase) {
    stateMachine.currentPhase = newPhase;
}
/** 解析 YAML frontmatter 为对象 */
function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match?.[1])
        return null;
    try {
        return parseSimpleYaml(match[1]);
    }
    catch {
        return null;
    }
}
/** 解析单个 YAML 值 */
function parseYamlValue(raw) {
    const value = raw.trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }
    if (value === 'true')
        return true;
    if (value === 'false')
        return false;
    if (/^\d+$/.test(value))
        return parseInt(value, 10);
    return value;
}
/**
 * 简易 YAML 解析器，支持基本 key: value 和列表结构。
 */
function parseSimpleYaml(yaml) {
    const result = {};
    const lines = yaml.split('\n');
    let currentKey = '';
    let currentList = [];
    let inList = false;
    function flushList() {
        if (inList && currentKey) {
            result[currentKey] = [...currentList];
            currentList = [];
            inList = false;
            currentKey = '';
        }
    }
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '') {
            flushList();
            continue;
        }
        // 列表项
        if (/^\s*-\s/.test(line)) {
            inList = true;
            const trimmed = line.replace(/^\s*-\s*/, '');
            const item = {};
            const subLines = [trimmed];
            for (let j = i + 1; j < lines.length; j++) {
                const nl = lines[j];
                if (nl && nl.startsWith('    ') && !/^\s*-\s/.test(nl)) {
                    subLines.push(nl.slice(4));
                }
                else {
                    break;
                }
            }
            for (const sl of subLines) {
                const kvMatch = sl.match(/^(\w+):\s*(.*)$/);
                if (kvMatch && kvMatch[1]) {
                    item[kvMatch[1]] = parseYamlValue(kvMatch[2] ?? '');
                }
            }
            currentList.push(Object.keys(item).length > 0 ? item : parseYamlValue(trimmed));
            continue;
        }
        flushList();
        const kvMatch = line.match(/^(\w+):\s*(.*)$/);
        if (kvMatch && kvMatch[1]) {
            const key = kvMatch[1];
            const value = (kvMatch[2] ?? '').trim();
            if (value === '' || value === '|') {
                currentKey = key;
            }
            else {
                result[key] = parseYamlValue(value);
            }
        }
    }
    flushList();
    return result;
}
