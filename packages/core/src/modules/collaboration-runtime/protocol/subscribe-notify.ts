/**
 * Subscribe-Notify Protocol — 订阅-通知协议实现。
 *
 * Story 9.14: 招标-投标 + 订阅-通知协议
 *
 * 协议流程：
 * 1. Agent 订阅感兴趣的事件/主题
 * 2. 发布者向订阅者发送通知
 * 3. 订阅者可随时取消订阅
 */

import type { Blackboard } from "../session/blackboard";
import { AclProtocol } from "./acl";

// =============================================================================
// Types
// =============================================================================

export interface Subscription {
  subscriberId: string;
  topic: string;
  conversationId: string;
  createdAt: string;
  filter?: Record<string, unknown>; // 可选过滤条件
}

export interface Notification {
  topic: string;
  content: unknown;
  senderId: string;
  timestamp: string;
  conversationId: string;
}

export interface SubscriptionGroup {
  topic: string;
  subscribers: Subscription[];
}

// =============================================================================
// SubscribeNotifyProtocol
// =============================================================================

export class SubscribeNotifyProtocol {
  private acl = new AclProtocol();
  private subscriptions = new Map<string, SubscriptionGroup>(); // topic → group
  private notifications = new Map<string, Notification[]>(); // conversationId → notifications

  /**
   * 订阅主题。
   * Agent 向指定主题发送 subscribe 消息。
   */
  subscribe(
    subscriberId: string,
    topic: string,
    filter?: Record<string, unknown>,
    blackboard?: Blackboard
  ): Subscription {
    const conversationId = `sub-${topic}-${subscriberId}-${Date.now()}`;

    const subscription: Subscription = {
      subscriberId,
      topic,
      conversationId,
      createdAt: new Date().toISOString(),
      filter,
    };

    // 注册订阅者
    this.acl.registerAgent(subscriberId);

    // 添加到订阅组
    let group = this.subscriptions.get(topic);
    if (!group) {
      group = { topic, subscribers: [] };
      this.subscriptions.set(topic, group);
    }
    group.subscribers.push(subscription);

    // 发送 subscribe 消息到黑板（可选）
    if (blackboard) {
      const msg = this.acl.createMessage({
        performative: "subscribe",
        sender: subscriberId,
        receiver: topic,
        content: { topic, filter },
        conversationId,
      });
      this.acl.send(msg, blackboard);
    }

    return subscription;
  }

  /**
   * 取消订阅。
   */
  unsubscribe(
    subscriberId: string,
    topic: string,
    blackboard?: Blackboard
  ): boolean {
    const group = this.subscriptions.get(topic);
    if (!group) return false;

    const subIndex = group.subscribers.findIndex(
      (s) => s.subscriberId === subscriberId
    );
    if (subIndex === -1) return false;

    const sub = group.subscribers[subIndex]!;
    group.subscribers.splice(subIndex, 1);

    // 发送 unsubscribe 消息（可选）
    if (blackboard) {
      const msg = this.acl.createMessage({
        performative: "inform",
        sender: subscriberId,
        receiver: topic,
        content: { topic, action: "unsubscribe" },
        conversationId: sub.conversationId,
      });
      this.acl.send(msg, blackboard);
    }

    // 清理空组
    if (group.subscribers.length === 0) {
      this.subscriptions.delete(topic);
    }

    return true;
  }

  /**
   * 向指定主题的所有订阅者发送通知。
   * 返回成功发送的订阅者列表。
   */
  notify(
    topic: string,
    content: unknown,
    senderId: string,
    blackboard: Blackboard
  ): string[] {
    const group = this.subscriptions.get(topic);
    if (!group || group.subscribers.length === 0) {
      return [];
    }

    const conversationId = `notif-${topic}-${Date.now()}`;
    const notification: Notification = {
      topic,
      content,
      senderId,
      timestamp: new Date().toISOString(),
      conversationId,
    };

    // 记录通知
    this.notifications.set(conversationId, [notification]);

    const notified: string[] = [];

    for (const sub of group.subscribers) {
      // 应用过滤器
      if (sub.filter && !this.matchFilter(content, sub.filter)) {
        continue;
      }

      const msg = this.acl.createMessage({
        performative: "inform",
        sender: senderId,
        receiver: sub.subscriberId,
        content,
        conversationId: sub.conversationId,
      });
      this.acl.send(msg, blackboard);
      notified.push(sub.subscriberId);
    }

    return notified;
  }

  /**
   * 广播通知（向所有主题的所有订阅者）。
   */
  broadcast(
    content: unknown,
    senderId: string,
    blackboard: Blackboard
  ): number {
    let count = 0;
    for (const [topic] of this.subscriptions) {
      const notified = this.notify(topic, content, senderId, blackboard);
      count += notified.length;
    }
    return count;
  }

  /**
   * 获取主题的订阅者列表。
   */
  getSubscribers(topic: string): Subscription[] {
    const group = this.subscriptions.get(topic);
    return group ? [...group.subscribers] : [];
  }

  /**
   * 获取 Agent 的所有订阅。
   */
  getSubscriptionsByAgent(subscriberId: string): Subscription[] {
    const result: Subscription[] = [];
    for (const group of this.subscriptions.values()) {
      for (const sub of group.subscribers) {
        if (sub.subscriberId === subscriberId) {
          result.push(sub);
        }
      }
    }
    return result;
  }

  /**
   * 获取通知历史。
   */
  getNotifications(conversationId: string): Notification[] {
    return this.notifications.get(conversationId) ?? [];
  }

  /**
   * 获取所有主题。
   */
  listTopics(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * 获取订阅统计。
   */
  getStats(): { topics: number; totalSubscriptions: number } {
    let totalSubscriptions = 0;
    for (const group of this.subscriptions.values()) {
      totalSubscriptions += group.subscribers.length;
    }
    return {
      topics: this.subscriptions.size,
      totalSubscriptions,
    };
  }

  /**
   * 清除指定主题的所有订阅。
   */
  clearTopic(topic: string): void {
    this.subscriptions.delete(topic);
  }

  /**
   * 清除所有订阅。
   */
  clearAll(): void {
    this.subscriptions.clear();
    this.notifications.clear();
  }

  /**
   * 简单过滤器匹配。
   */
  private matchFilter(
    content: unknown,
    filter: Record<string, unknown>
  ): boolean {
    if (typeof content !== "object" || content === null) {
      return false;
    }
    for (const [key, value] of Object.entries(filter)) {
      if ((content as Record<string, unknown>)[key] !== value) {
        return false;
      }
    }
    return true;
  }
}
