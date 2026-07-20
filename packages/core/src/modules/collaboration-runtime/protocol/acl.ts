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

import type { ACLMessage, Performative } from "../session/types";
import { Blackboard } from "../session/blackboard";

// ============================================================================
// Types
// ============================================================================

const VALID_PERFORMATIVES = new Set<string>([
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

export interface CreateMessageParams {
  performative: Performative;
  sender: string;
  receiver: string;
  content: unknown;
  conversationId?: string;
  replyWith?: string;
  inReplyTo?: string;
}

export interface AclSendResult {
  delivered: string[]; // 成功送达的 Agent IDs
  message: ACLMessage;
}

// ============================================================================
// AclProtocol
// ============================================================================

export class AclProtocol {
  private registeredAgents: Set<string> = new Set();

  /**
   * 注册 Agent 到路由表。
   * 广播消息会发送给所有已注册的 Agent。
   */
  registerAgent(agentId: string): void {
    this.registeredAgents.add(agentId);
  }

  /**
   * 移除 Agent。
   */
  unregisterAgent(agentId: string): void {
    this.registeredAgents.delete(agentId);
  }

  /**
   * 获取已注册的 Agent 列表。
   */
  getRegisteredAgents(): string[] {
    return Array.from(this.registeredAgents);
  }

  /**
   * 创建 ACL 消息。
   * 自动验证 performative 合法性。
   */
  createMessage(params: CreateMessageParams): ACLMessage {
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
  send(msg: ACLMessage, blackboard: Blackboard): AclSendResult {
    const delivered: string[] = [];

    if (msg.receiver === "*") {
      // 广播：发送给所有已注册 Agent
      for (const agentId of this.registeredAgents) {
        if (agentId !== msg.sender) {
          const broadcastMsg = { ...msg, receiver: agentId };
          blackboard.sendMessage(broadcastMsg);
          delivered.push(agentId);
        }
      }
    } else {
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
  getUnread(
    agentId: string,
    blackboard: Blackboard,
    options?: { conversationId?: string }
  ): ACLMessage[] {
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
  matchResponse(requestMsg: ACLMessage, blackboard: Blackboard): ACLMessage | null {
    if (!requestMsg.replyWith) {
      return null;
    }

    // 获取所有响应者可能看到的消息（包括 request.sender 能看到的）
    const allMessages = blackboard.getMessages(requestMsg.sender);

    return (
      allMessages.find(
        (m) =>
          m.receiver === requestMsg.sender &&
          m.inReplyTo === requestMsg.replyWith
      ) ?? null
    );
  }

  /**
   * 根据 conversationId 获取该对话的所有消息历史。
   */
  getConversationHistory(
    conversationId: string,
    blackboard: Blackboard
  ): ACLMessage[] {
    const allAgents = this.registeredAgents;
    const messages: ACLMessage[] = [];
    const seen = new Set<string>();

    for (const agentId of allAgents) {
      const agentMessages = blackboard.getMessages(agentId);
      for (const msg of agentMessages) {
        if (msg.conversationId === conversationId && !seen.has(msg.id)) {
          messages.push(msg);
          seen.add(msg.id);
        }
      }
    }

    return messages.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * 验证消息格式。
   * 返回错误信息数组，空数组表示合法。
   */
  validateMessage(msg: Partial<ACLMessage>): string[] {
    const errors: string[] = [];

    if (!msg.performative) {
      errors.push("performative is required");
    } else if (!VALID_PERFORMATIVES.has(msg.performative)) {
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

  private generateId(): string {
    return `acl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
