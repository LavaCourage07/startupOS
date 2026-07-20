"use strict";
/**
 * Block — 记忆基本单元。
 *
 * Story M.1: 类型定义与 Block 抽象
 *
 * 借鉴 Letta BaseBlock，扩展 OriginOS 需求：
 * - namespace 支持层级标签（system/persona）
 * - tags 支持分类和语义检索
 * - version 支持版本追溯
 * - 去除 Letta 多租户字段（template_*, deployment_id）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BLOCKS = void 0;
exports.createBlock = createBlock;
exports.validateBlock = validateBlock;
exports.toLegacyBlock = toLegacyBlock;
exports.fromLegacyBlock = fromLegacyBlock;
exports.serializeBlock = serializeBlock;
exports.deserializeBlock = deserializeBlock;
// ============================================================================
// Default Blocks
// ============================================================================
exports.DEFAULT_BLOCKS = [
    { label: 'human', description: '用户画像、偏好、历史习惯', limit: 2000, namespace: 'system' },
    { label: 'persona', description: 'Agent 角色认知、工作风格、专业语言', limit: 2000, namespace: 'system' },
    { label: 'project', description: '当前项目状态、活跃任务、关键决策', limit: 3000, namespace: 'system' },
    { label: 'scratchpad', description: '临时笔记、待办、注意项', limit: 1000, namespace: 'system' },
    { label: 'temporal', description: '关键事件时间线', limit: 3000, readOnly: true, namespace: 'system' },
];
// ============================================================================
// Factory & Utilities
// ============================================================================
/** 生成唯一 ID */
function generateId() {
    return `block-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}
/** 从 BlockDefinition 创建 Block 实例 */
function createBlock(def, value = '') {
    const now = Date.now();
    return {
        id: generateId(),
        label: def.label,
        value,
        limit: def.limit,
        description: def.description,
        metadata: {},
        readOnly: def.readOnly ?? false,
        tags: def.tags ?? [],
        namespace: def.namespace,
        createdAt: now,
        updatedAt: now,
        version: 1,
    };
}
/** 校验 Block 是否有效 */
function validateBlock(block) {
    if (!block.label || block.label.trim() === '') {
        return 'Block label must not be empty';
    }
    if (block.value.length > block.limit) {
        return `Block value exceeds limit (${block.value.length} > ${block.limit})`;
    }
    if (block.limit <= 0) {
        return 'Block limit must be positive';
    }
    return null;
}
/** 将 Block 转换为旧 MemoryBlock 格式（兼容层） */
function toLegacyBlock(block) {
    return {
        label: block.label,
        value: block.value,
        limit: block.limit,
        description: block.description,
        metadata: block.metadata,
        readOnly: block.readOnly,
    };
}
/** 将旧 MemoryBlock 转换为新 Block 格式 */
function fromLegacyBlock(legacy, overrides) {
    const now = Date.now();
    return {
        id: overrides?.id ?? generateId(),
        label: legacy.label,
        value: legacy.value,
        limit: legacy.limit,
        description: legacy.description,
        metadata: legacy.metadata,
        readOnly: legacy.readOnly,
        tags: overrides?.tags ?? [],
        namespace: overrides?.namespace,
        createdAt: overrides?.createdAt ?? now,
        updatedAt: overrides?.updatedAt ?? now,
        version: overrides?.version ?? 1,
    };
}
/** 序列化 Block 为 JSON（用于持久化） */
function serializeBlock(block) {
    return { ...block };
}
/** 从 JSON 反序列化 Block */
function deserializeBlock(data) {
    return {
        id: String(data['id'] ?? ''),
        label: String(data['label'] ?? ''),
        value: String(data['value'] ?? ''),
        limit: Number(data['limit'] ?? 2000),
        description: String(data['description'] ?? ''),
        metadata: (data['metadata'] ?? {}),
        readOnly: Boolean(data['readOnly']),
        tags: Array.isArray(data['tags']) ? data['tags'] : [],
        namespace: typeof data['namespace'] === 'string' ? data['namespace'] : undefined,
        createdAt: Number(data['createdAt'] ?? Date.now()),
        updatedAt: Number(data['updatedAt'] ?? Date.now()),
        version: Number(data['version'] ?? 1),
    };
}
