"use strict";
/**
 * Rule Engine — mixed mode (natural language + structured json-logic)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleEngine = void 0;
class RuleEngine {
    constructor(ontology) {
        this.ontology = ontology;
    }
    /**
     * 验证所有 enabled 规则。
     * 结构化规则（json-logic）→ 机器求值
     * 自然语言规则 → 生成 Agent prompt 供人工判断
     */
    validate() {
        const violations = [];
        const agentPrompts = [];
        for (const rule of this.ontology.rules) {
            if (!rule.enabled)
                continue;
            if (rule.expression?.format === 'json-logic') {
                const v = this.evaluateStructuredRule(rule);
                if (v)
                    violations.push(v);
            }
            else {
                // 自然语言规则：生成 Agent 可理解的 prompt
                agentPrompts.push(this.buildAgentPrompt(rule));
            }
        }
        return {
            valid: violations.length === 0,
            violations,
            agentPrompts,
        };
    }
    /**
     * 仅验证结构化规则（机器可验证部分）
     */
    validateStructuredOnly() {
        const violations = [];
        for (const rule of this.ontology.rules) {
            if (!rule.enabled || !rule.expression)
                continue;
            if (rule.expression.format !== 'json-logic')
                continue;
            const v = this.evaluateStructuredRule(rule);
            if (v)
                violations.push(v);
        }
        return { valid: violations.length === 0, violations };
    }
    /**
     * 获取所有自然语言规则的描述（供 Agent 参考）
     */
    getNaturalLanguageRules() {
        return this.ontology.rules.filter(r => r.enabled && !r.expression);
    }
    evaluateStructuredRule(rule) {
        const expr = rule.expression;
        if (expr.format !== 'json-logic')
            return null;
        const result = evaluateJsonLogic(expr.body, this.ontology);
        if (result === false) {
            return {
                ruleId: rule.id,
                ruleName: rule.name,
                severity: rule.severity,
                message: rule.description,
            };
        }
        return null;
    }
    buildAgentPrompt(rule) {
        const severityLabel = rule.severity === 'error' ? '必须遵守' : rule.severity === 'warning' ? '建议遵守' : '参考';
        return {
            ruleId: rule.id,
            ruleName: rule.name,
            description: rule.description,
            prompt: `【${severityLabel}】规则「${rule.name}」（${rule.type}）：${rule.description}\n请检查当前本体状态是否违反此规则。`,
        };
    }
    /**
     * 添加新规则并立即验证
     */
    addAndValidate(rule) {
        const created = this.ontology.addRule(rule);
        return { rule: created, result: this.validate() };
    }
}
exports.RuleEngine = RuleEngine;
// ============================================================================
// Json-Logic Evaluator (shared with unified-ontology.ts)
// ============================================================================
function evaluateJsonLogic(expr, ctx) {
    if (typeof expr !== 'object' || expr === null || Array.isArray(expr)) {
        return expr;
    }
    const obj = expr;
    const keys = Object.keys(obj);
    if (keys.length !== 1)
        return true;
    const op = keys[0];
    const argsVal = Object.values(obj)[0];
    const args = Array.isArray(argsVal) ? argsVal : [];
    switch (op) {
        case '==': return JSON.stringify(evaluateJsonLogic(args[0], ctx)) === JSON.stringify(evaluateJsonLogic(args[1], ctx));
        case '!=': return JSON.stringify(evaluateJsonLogic(args[0], ctx)) !== JSON.stringify(evaluateJsonLogic(args[1], ctx));
        case '>': return evaluateJsonLogic(args[0], ctx) > evaluateJsonLogic(args[1], ctx);
        case '<': return evaluateJsonLogic(args[0], ctx) < evaluateJsonLogic(args[1], ctx);
        case '>=': return evaluateJsonLogic(args[0], ctx) >= evaluateJsonLogic(args[1], ctx);
        case '<=': return evaluateJsonLogic(args[0], ctx) <= evaluateJsonLogic(args[1], ctx);
        case 'and': return args.every(a => evaluateJsonLogic(a, ctx));
        case 'or': return args.some(a => evaluateJsonLogic(a, ctx));
        case 'not': return !evaluateJsonLogic(args[0], ctx);
        case 'if': {
            const cond = evaluateJsonLogic(args[0], ctx);
            return cond ? evaluateJsonLogic(args[1], ctx) : evaluateJsonLogic(args[2] ?? null, ctx);
        }
        case 'filter': {
            const entityType = args[0];
            const predicate = args[1];
            const o = ctx;
            const entities = o['entities']?.filter((e) => e.type === entityType) ?? [];
            return entities.filter((e) => evaluateJsonLogic(predicate, e));
        }
        case 'count': {
            const arr = evaluateJsonLogic(args[0], ctx);
            return Array.isArray(arr) ? arr.length : 0;
        }
        case 'var': {
            const varPath = args[0];
            return resolveVar(ctx, varPath);
        }
        default: return true;
    }
}
function resolveVar(ctx, varPath) {
    const parts = varPath.split('.');
    let current = ctx;
    for (const part of parts) {
        if (current === null || current === undefined)
            return undefined;
        if (typeof current !== 'object')
            return undefined;
        const obj = current;
        current = obj[part];
    }
    return current;
}
