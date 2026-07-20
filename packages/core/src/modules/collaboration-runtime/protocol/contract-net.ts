/**
 * Contract Net Protocol — 招标-投标协议实现。
 *
 * Story 9.14: 招标-投标 + 订阅-通知协议
 *
 * 协议流程：
 * 1. Supervisor 发起招标 (cfp) → 发送给候选 Agent
 * 2. 候选 Agent 投标 (propose) → 回复方案
 * 3. Supervisor 选择中标者 (accept/reject)
 * 4. 中标者执行并通知结果 (inform)
 */

import type { Blackboard } from "../session/blackboard";
import { AclProtocol } from "./acl";

// ============================================================================
// Types
// ============================================================================

export interface TaskDescription {
  id: string;
  description: string;
  requiredCapabilities?: string[];
  deadline?: Date;
}

export interface Bid {
  agentId: string;
  conversationId: string;
  confidence: number; // 0-1 置信度
  estimatedCost: { tokens: number; timeMs: number };
  proposal: string; // 方案描述
  timestamp: string;
}

export type ContractNetState =
  | "idle"
  | "cfp_sent"
  | "proposals_received"
  | "accepted"
  | "rejected"
  | "completed"
  | "timed_out";

export interface ContractNetSession {
  conversationId: string;
  task: TaskDescription;
  candidates: string[];
  state: ContractNetState;
  bids: Bid[];
  winnerAgentId?: string;
  deadline: Date;
  createdAt: string;
}

// ============================================================================
// ContractNetProtocol
// ============================================================================

export class ContractNetProtocol {
  private acl = new AclProtocol();
  private sessions = new Map<string, ContractNetSession>();

  /**
   * 发起招标 (Call For Proposal)。
   * 向所有候选 Agent 发送 cfp 消息。
   *
   * @returns conversationId 用于跟踪本次招标会话
   */
  async callForProposal(
    task: TaskDescription,
    candidates: string[],
    deadline: Date,
    blackboard: Blackboard
  ): Promise<string> {
    const conversationId = `cn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 注册候选 Agent
    for (const agentId of candidates) {
      this.acl.registerAgent(agentId);
    }

    // 创建会话
    const session: ContractNetSession = {
      conversationId,
      task,
      candidates: [...candidates],
      state: "cfp_sent",
      bids: [],
      deadline,
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(conversationId, session);

    // 向所有候选 Agent 发送 cfp
    for (const agentId of candidates) {
      const msg = this.acl.createMessage({
        performative: "cfp",
        sender: "supervisor",
        receiver: agentId,
        content: task,
        conversationId,
      });
      this.acl.send(msg, blackboard);
    }

    return conversationId;
  }

  /**
   * Worker 投标。
   * 将投标记录添加到会话中。
   */
  propose(
    conversationId: string,
    agentId: string,
    bid: Omit<Bid, "agentId" | "conversationId" | "timestamp">,
    blackboard: Blackboard
  ): void {
    const session = this.sessions.get(conversationId);
    if (!session) {
      throw new Error(`ContractNet session ${conversationId} not found`);
    }

    // 检查超时
    if (new Date() > session.deadline) {
      throw new Error(`Proposal deadline expired for ${conversationId}`);
    }

    // 检查是否是该会话的候选者
    if (!session.candidates.includes(agentId)) {
      throw new Error(`Agent ${agentId} is not a candidate for ${conversationId}`);
    }

    // 检查是否已投标
    if (session.bids.some((b) => b.agentId === agentId)) {
      throw new Error(`Agent ${agentId} has already proposed for ${conversationId}`);
    }

    const fullBid: Bid = {
      ...bid,
      agentId,
      conversationId,
      timestamp: new Date().toISOString(),
    };
    session.bids.push(fullBid);

    // 发送 propose 消息
    const msg = this.acl.createMessage({
      performative: "propose",
      sender: agentId,
      receiver: "supervisor",
      content: fullBid,
      conversationId,
      replyWith: `bid-${agentId}-${Date.now()}`,
    });
    this.acl.send(msg, blackboard);
  }

  /**
   * Supervisor 选择中标者。
   * 向中标者发送 accept，向落标者发送 reject。
   */
  acceptProposal(
    conversationId: string,
    winnerAgentId: string,
    blackboard: Blackboard
  ): void {
    const session = this.sessions.get(conversationId);
    if (!session) {
      throw new Error(`ContractNet session ${conversationId} not found`);
    }

    // 验证中标者确实投了标
    const winningBid = session.bids.find((b) => b.agentId === winnerAgentId);
    if (!winningBid) {
      throw new Error(
        `Agent ${winnerAgentId} did not propose for ${conversationId}`
      );
    }

    session.winnerAgentId = winnerAgentId;
    session.state = "accepted";

    // 发送 accept 给中标者
    const acceptMsg = this.acl.createMessage({
      performative: "accept",
      sender: "supervisor",
      receiver: winnerAgentId,
      content: { task: session.task, bid: winningBid },
      conversationId,
      inReplyTo: `bid-${winnerAgentId}`,
    });
    this.acl.send(acceptMsg, blackboard);

    // 发送 reject 给落标者
    for (const candidateId of session.candidates) {
      if (candidateId !== winnerAgentId) {
        const rejectMsg = this.acl.createMessage({
          performative: "reject",
          sender: "supervisor",
          receiver: candidateId,
          content: { reason: "Another bid was selected" },
          conversationId,
        });
        this.acl.send(rejectMsg, blackboard);
      }
    }
  }

  /**
   * Supervisor 拒绝所有投标。
   */
  rejectAll(conversationId: string, blackboard: Blackboard): void {
    const session = this.sessions.get(conversationId);
    if (!session) {
      throw new Error(`ContractNet session ${conversationId} not found`);
    }

    session.state = "rejected";

    for (const candidateId of session.candidates) {
      const msg = this.acl.createMessage({
        performative: "reject",
        sender: "supervisor",
        receiver: candidateId,
        content: { reason: "No suitable proposal found" },
        conversationId,
      });
      this.acl.send(msg, blackboard);
    }
  }

  /**
   * 获取投标列表。
   */
  getBids(conversationId: string): Bid[] {
    const session = this.sessions.get(conversationId);
    if (!session) {
      throw new Error(`ContractNet session ${conversationId} not found`);
    }
    return [...session.bids];
  }

  /**
   * 获取会话状态。
   */
  getSession(conversationId: string): ContractNetSession | undefined {
    return this.sessions.get(conversationId);
  }

  /**
   * 选择最佳投标（最高置信度）。
   */
  selectBestBid(conversationId: string): Bid | undefined {
    const session = this.sessions.get(conversationId);
    if (!session || session.bids.length === 0) {
      return undefined;
    }
    return session.bids.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );
  }

  /**
   * 标记会话完成。
   */
  complete(conversationId: string): void {
    const session = this.sessions.get(conversationId);
    if (session) {
      session.state = "completed";
    }
  }

  /**
   * 标记会话超时。
   */
  timeout(conversationId: string): void {
    const session = this.sessions.get(conversationId);
    if (session) {
      session.state = "timed_out";
    }
  }

  /**
   * 清除已完成的会话。
   */
  cleanup(conversationId?: string): void {
    if (conversationId) {
      this.sessions.delete(conversationId);
    } else {
      // 清理所有已完成的会话
      for (const [id, session] of this.sessions) {
        if (session.state === "completed" || session.state === "timed_out") {
          this.sessions.delete(id);
        }
      }
    }
  }
}
