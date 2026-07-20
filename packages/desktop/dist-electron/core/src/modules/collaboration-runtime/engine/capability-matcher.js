"use strict";
/**
 * Capability Matcher — 多维权 Agent 匹配与动态路由（本体契约版本）
 *
 * Story 9.16 + 9.36: 能力匹配与动态路由 + 基于本体契约的资源感知
 *
 * 核心概念：资源感知基于本体实例数据操作和 Skill I/O 契约，
 * 而非通用的 CPU/内存指标。
 *
 * 匹配维度（加权评分）：
 * | 维度 | 权重 | 来源 |
 * | domain 匹配 | 20% | task.domain vs Agent.domain |
 * | skill 匹配 | 20% | task.requiredSkills vs Agent.skills |
 * | ontology 权限 | 30% | 检查 Agent 可操作的本体类型 |
 * | Skill 契约 | 20% | Skill 输入/输出本体匹配 |
 * | 当前负载 | 10% | 本体操作复杂度（而非简单任务数） |
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CapabilityMatcher = void 0;
// ============================================================================
// Weights
// ============================================================================
// ============================================================================
// Weights
// ============================================================================
const WEIGHTS = {
    domain: 0.20,
    skill: 0.20,
    ontology: 0.30, // 本体操作权限
    skillContract: 0.20, // Skill I/O 契约
    load: 0.10, // 本体操作复杂度
};
// ============================================================================
// CapabilityMatcher
// ============================================================================
class CapabilityMatcher {
    /**
     * 根据任务需求对可用 Agent 评分并排序（降序）。
     */
    match(task, availableAgents) {
        if (availableAgents.length === 0)
            return [];
        const scored = availableAgents
            .map((agent) => this.scoreAgent(agent, task))
            .sort((a, b) => b.score - a.score);
        return scored;
    }
    /**
     * 对单个 Agent 评分（基于本体契约）。
     */
    scoreAgent(agent, task) {
        const breakdown = {
            domainMatch: this.scoreDomain(agent, task),
            skillMatch: this.scoreSkills(agent, task),
            ontologyMatch: this.scoreOntologyPermissions(agent, task),
            skillContractMatch: this.scoreSkillContract(agent, task),
            loadScore: this.scoreOntologyLoad(agent),
        };
        const totalScore = breakdown.domainMatch * WEIGHTS.domain +
            breakdown.skillMatch * WEIGHTS.skill +
            breakdown.ontologyMatch * WEIGHTS.ontology +
            breakdown.skillContractMatch * WEIGHTS.skillContract +
            breakdown.loadScore * WEIGHTS.load;
        // 如果本体权限不满足，直接返回 0 分
        if (task.requiredOntologyOperations && task.requiredOntologyOperations.length > 0) {
            const canOperate = this.checkOntologyCapabilities(agent, task);
            if (!canOperate) {
                return {
                    agentId: agent.agentId,
                    score: 0,
                    breakdown,
                };
            }
        }
        // 综合评分限制在 0-1
        const clampedScore = Math.max(0, Math.min(1, totalScore));
        return {
            agentId: agent.agentId,
            score: clampedScore,
            breakdown,
        };
    }
    /**
     * Domain 匹配评分（权重 30%）。
     *
     * 如果任务指定了 domain，计算 Agent domain 与任务 domain 的词重叠度。
     * 如果 Agent 没有定义 domain，返回 0.5 中性值。
     */
    scoreDomain(agent, task) {
        // 任务没有指定 domain → 无法评估，返回中性值
        if (!task.domain)
            return 0.5;
        // Agent 没有 domain → 中性
        if (!agent.domain)
            return 0.5;
        const taskWords = this.tokenize(task.domain);
        const agentWords = this.tokenize(agent.domain);
        if (taskWords.length === 0)
            return 0.5;
        const matches = taskWords.filter((w) => agentWords.some((aw) => aw === w || aw.includes(w) || w.includes(aw))).length;
        return matches / taskWords.length;
    }
    /**
     * Skill 匹配评分（权重 25%）。
     */
    scoreSkills(agent, task) {
        if (!task.requiredSkills || task.requiredSkills.length === 0) {
            return 0.5; // 任务不要求特定 skill → 中性
        }
        const matchCount = task.requiredSkills.filter((s) => agent.skills.includes(s)).length;
        return matchCount / task.requiredSkills.length;
    }
    /**
     * 本体权限匹配评分（权重 30%）。
     *
     * 检查 Agent 是否具备处理任务所需的本体操作权限。
     */
    scoreOntologyPermissions(agent, task) {
        if (!task.requiredOntologyOperations || task.requiredOntologyOperations.length === 0) {
            return 1.0; // 任务不要求本体操作 → 完全匹配
        }
        const allowedOps = agent.ontologyState?.allowedOperations ?? [];
        if (allowedOps.length === 0) {
            return 0.0; // Agent 没有本体权限 → 不匹配
        }
        const requiredTypes = Array.from(new Set(task.requiredOntologyOperations.map((op) => op.objectType)));
        const requiredOps = Array.from(new Set(task.requiredOntologyOperations.map((op) => op.operation)));
        if (requiredTypes.length === 0)
            return 1.0;
        let typeMatches = 0;
        let opMatches = 0;
        for (const requiredType of requiredTypes) {
            const typeSpec = allowedOps.find((spec) => spec.objectType === requiredType);
            if (typeSpec) {
                typeMatches++;
                for (const requiredOp of requiredOps) {
                    if (typeSpec.operations.includes(requiredOp)) {
                        opMatches++;
                    }
                }
            }
        }
        const typeScore = typeMatches / requiredTypes.length;
        const opScore = opMatches / (requiredOps.length * requiredTypes.length || 1);
        return (typeScore + opScore) / 2;
    }
    /**
     * Skill 契约匹配评分（权重 20%）。
     *
     * 如果指定了 Skill ID，验证其 I/O 本体契约是否匹配任务需求。
     */
    scoreSkillContract(agent, task) {
        if (!task.skillId) {
            return 1.0; // 未指定 Skill → 完全匹配
        }
        const skillContract = agent.ontologyState?.skillContracts.get(task.skillId);
        if (!skillContract) {
            return 0.0; // Agent 没有该 Skill → 不匹配
        }
        if (!task.requiredOntologyOperations || task.requiredOntologyOperations.length === 0) {
            return 0.5; // 任务无本体需求 → 中性
        }
        const requiredTypes = Array.from(new Set(task.requiredOntologyOperations.map((op) => op.objectType)));
        // 检查 Skill 输出是否包含所需的本体类型
        const skillOutputMatches = skillContract.outputOntologies.types.filter((type) => requiredTypes.includes(type)).length;
        // 检查 Skill 输入是否包含任务依赖的本体类型（如果有）
        const skillInputMatches = skillContract.inputOntologies.types.filter((type) => this.canAgentReadType(agent, type)).length;
        const outputScore = skillOutputMatches / Math.max(1, requiredTypes.length);
        const inputScore = skillInputMatches / Math.max(1, skillContract.inputOntologies.types.length);
        return (outputScore * 0.7 + inputScore * 0.3);
    }
    /**
     * 本体操作负载评分（权重 10%）。
     *
     * 基于当前正操作的本体实例数和复杂度，而非简单任务数。
     */
    scoreOntologyLoad(agent) {
        const ontologyState = agent.ontologyState;
        if (!ontologyState) {
            // 回退到简单任务数负载
            return this.scoreLoad(agent);
        }
        const activeInstances = ontologyState.activeOntologyInstances.size;
        const maxInstances = 20; // 假设每个 Agent 最多同时操作 20 个本体实例
        // 基于历史操作统计计算复杂度
        let complexity = 0;
        for (const instance of ontologyState.activeOntologyInstances.values()) {
            const stats = ontologyState.operationStats.get(`${instance.objectType}-${instance.operation}`);
            const avgDuration = stats?.avgDurationMs ?? 0;
            complexity += avgDuration / 1000; // 每秒一个复杂度单位
        }
        const instanceScore = Math.max(0, 1 - activeInstances / maxInstances);
        const complexityScore = Math.max(0, 1 - complexity / 60); // 60 秒视为满复杂度
        const ontologyLoadScore = (instanceScore * 0.7 + complexityScore * 0.3);
        // 如果没有任何活跃实例和操作统计，视为完全空闲
        if (activeInstances === 0 && ontologyState.operationStats.size === 0) {
            return 1.0;
        }
        return ontologyLoadScore;
    }
    /**
     * 检查 Agent 是否具备处理任务所需的本体操作能力
     */
    checkOntologyCapabilities(agent, task) {
        if (!task.requiredOntologyOperations || task.requiredOntologyOperations.length === 0) {
            return true; // 无本体操作要求
        }
        const allowedOps = agent.ontologyState?.allowedOperations ?? [];
        for (const requiredOps of task.requiredOntologyOperations) {
            const spec = allowedOps.find((op) => op.objectType === requiredOps.objectType);
            if (!spec || !spec.operations.includes(requiredOps.operation)) {
                return false;
            }
        }
        return true;
    }
    /**
     * 检查 Agent 是否可读取指定本体类型
     */
    canAgentReadType(agent, ontologyType) {
        if (!agent.allowedOntologies)
            return false;
        return agent.allowedOntologies.includes(ontologyType);
    }
    /**
     * 负载评分（兼容旧版）
     */
    scoreLoad(_agent) {
        return 0;
    }
    /**
     * 简单分词器：转小写 + 分割。
     */
    tokenize(text) {
        return text
            .toLowerCase()
            .split(/[\s\-_]+/)
            .filter((w) => w.length > 0);
    }
}
exports.CapabilityMatcher = CapabilityMatcher;
