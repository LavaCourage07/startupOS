"use strict";
/**
 * 工具执行上下文管理器
 * 提供工具执行时需要的上下文信息
 *
 * 设计原则：工具层不关心平台概念（Agent/Skill/Project），
 * workingDirectory 由上游（agent-manager）统一解析后传入。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getToolContextManager = getToolContextManager;
exports.setToolContext = setToolContext;
exports.getToolContext = getToolContext;
exports.removeToolContext = removeToolContext;
/**
 * 上下文管理器类
 */
class ToolContextManager {
    constructor() {
        this.contexts = new Map();
        this.defaultContext = {};
    }
    setContext(sessionId, context) {
        this.contexts.set(sessionId, context);
    }
    getContext(sessionId) {
        if (!sessionId) {
            return this.defaultContext;
        }
        return this.contexts.get(sessionId) || this.defaultContext;
    }
    removeContext(sessionId) {
        this.contexts.delete(sessionId);
    }
    clear() {
        this.contexts.clear();
    }
    setDefaultContext(context) {
        this.defaultContext = context;
    }
}
const globalContextManager = new ToolContextManager();
function getToolContextManager() {
    return globalContextManager;
}
function setToolContext(sessionId, context) {
    globalContextManager.setContext(sessionId, context);
}
function getToolContext(sessionId) {
    return globalContextManager.getContext(sessionId);
}
function removeToolContext(sessionId) {
    globalContextManager.removeContext(sessionId);
}
