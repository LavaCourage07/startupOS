"use strict";
/**
 * 认知系统类型定义（Epic C）
 *
 * 核心类型已迁移到 @/lib/shared/cognitive（AG.2），此处重导出保持向后兼容。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BLOCKS = void 0;
/** 默认 5 个 Block */
exports.DEFAULT_BLOCKS = [
    { label: 'human', description: '用户画像、偏好、历史习惯', limit: 2000 },
    { label: 'persona', description: 'Agent 角色认知、工作风格、专业语言', limit: 2000 },
    { label: 'project', description: '当前项目状态、活跃任务、关键决策', limit: 2000 },
    { label: 'scratchpad', description: '临时笔记、待办、注意项', limit: 1000 },
    { label: 'temporal', description: '关键事件时间线', limit: 3000, readOnly: true },
];
