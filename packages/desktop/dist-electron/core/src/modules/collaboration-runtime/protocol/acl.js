"use strict";
/**
 * ACL Message Protocol — 多 Agent 协作通信层。
 *
 * Story 9.9: ACL 消息协议
 *
 * 实现：
 * - 创建标准化 ACL 消息
 * - 发送消息到黑板（自动路由：广播/定向）
 * - 获取目标 Agent 的未读消息（conversationId 隔离）
 * - request → inform 匹配
 * - 消息验证
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AclProtocol = void 0;
// ============================================================================
// Types
// ============================================================================
const VALID_PERFORMATIVES = new Set([
    "inform",
    "request",
    "query",
    "propose",
    "accept",
    "reject",
    "cfp",
    "subscribe",
    "notify",
    "failure",
    "refuse",
    "agree",
    "delegate",
]);
// ============================================================================
// AclProtocol
// ============================================================================
class AclProtocol {
    constructor() {
        this.registeredAgents = new Set();
    }
    /**
     * 注册 Agent 到路由表。
     * 广播消息会发送给所有已注册的 Agent。
     */
    registerAgent(agentId) {
        this.registeredAgents.add(agentId);
    }
    /**
     * 移除 Agent。
     */
    unregisterAgent(agentId) {
        this.registeredAgents.delete(agentId);
    }
    /**
     * 获取已注册的 Agent 列表。
     */
    getRegisteredAgents() {
        return Array.from(this.registeredAgents);
    }
    /**
     * 创建 ACL 消息。
     * 自动验证 performative 合法性。
     */
    createMessage(params) {
        if (!VALID_PERFORMATIVES.has(params.performative)) {
            throw new Error(`Invalid performative: "${params.performative}"`);
        }
        if (!params.sender || !params.receiver) {
            throw new Error("sender and receiver are required");
        }
        return {
            id: this.generateId(),
            performative: params.performative,
            sender: params.sender,
            receiver: params.receiver,
            content: params.content,
            conversationId: params.conversationId,
            replyWith: params.replyWith,
            inReplyTo: params.inReplyTo,
            timestamp: new Date().toISOString(),
        };
    }
    /**
     * 发送消息到黑板。
     * 广播消息（receiver: '*'）自动分发给所有已注册 Agent。
     * 定向消息（receiver: 具体 ID）写入黑板对应 Agent 的消息队列。
     *
     * @returns 送达结果，包含送达的 Agent IDs 和原始消息
     */
    send(msg, blackboard) {
        const delivered = [];
        if (msg.receiver === "*") {
            // 广播：发送给所有已注册 Agent
            for (const agentId of this.registeredAgents) {
                if (agentId !== msg.sender) {
                    const broadcastMsg = { ...msg, receiver: agentId };
                    blackboard.sendMessage(broadcastMsg);
                    delivered.push(agentId);
                }
            }
        }
        else {
            // 定向消息
            blackboard.sendMessage(msg);
            delivered.push(msg.receiver);
        }
        return { delivered, message: msg };
    }
    /**
     * 获取目标 Agent 的未读消息。
     * 可通过 conversationId 隔离不同对话流。
     */
    getUnread(agentId, blackboard, options) {
        const allMessages = blackboard.getMessages(agentId);
        const unread = allMessages.filter((m) => m.receiver === agentId);
        if (options?.conversationId) {
            return unread.filter((m) => m.conversationId === options.conversationId);
        }
        return unread;
    }
    /**
     * 匹配 request 的 response。
     * 查找黑板上所有 inReplyTo === request.replyWith 且 receiver === request.sender 的消息。
     */
    matchResponse(requestMsg, blackboard) {
        if (!requestMsg.replyWith) {
            return null;
        }
        // 获取所有响应者可能看到的消息（包括 request.sender 能看到的）
        const allMessages = blackboard.getMessages(requestMsg.sender);
        return (allMessages.find((m) => m.receiver === requestMsg.sender &&
            m.inReplyTo === requestMsg.replyWith) ?? null);
    }
    /**
     * 根据 conversationId 获取该对话的所有消息历史。
     */
    getConversationHistory(conversationId, blackboard) {
        const allAgents = this.registeredAgents;
        const messages = [];
        const seen = new Set();
        for (const agentId of allAgents) {
            const agentMessages = blackboard.getMessages(agentId);
            for (const msg of agentMessages) {
                if (msg.conversationId === conversationId && !seen.has(msg.id)) {
                    messages.push(msg);
                    seen.add(msg.id);
                }
            }
        }
        return messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    /**
     * 验证消息格式。
     * 返回错误信息数组，空数组表示合法。
     */
    validateMessage(msg) {
        const errors = [];
        if (!msg.performative) {
            errors.push("performative is required");
        }
        else if (!VALID_PERFORMATIVES.has(msg.performative)) {
            errors.push(`Invalid performative: "${msg.performative}"`);
        }
        if (!msg.sender) {
            errors.push("sender is required");
        }
        if (!msg.receiver) {
            errors.push("receiver is required");
        }
        if (msg.content === undefined) {
            errors.push("content is required");
        }
        return errors;
    }
    generateId() {
        return `acl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
}
exports.AclProtocol = AclProtocol;
