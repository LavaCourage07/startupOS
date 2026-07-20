"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscribeNotifyProtocol = void 0;
const acl_1 = require("./acl");
// =============================================================================
// SubscribeNotifyProtocol
// =============================================================================
class SubscribeNotifyProtocol {
    constructor() {
        this.acl = new acl_1.AclProtocol();
        this.subscriptions = new Map(); // topic → group
        this.notifications = new Map(); // conversationId → notifications
    }
    /**
     * 订阅主题。
     * Agent 向指定主题发送 subscribe 消息。
     */
    subscribe(subscriberId, topic, filter, blackboard) {
        const conversationId = `sub-${topic}-${subscriberId}-${Date.now()}`;
        const subscription = {
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
    unsubscribe(subscriberId, topic, blackboard) {
        const group = this.subscriptions.get(topic);
        if (!group)
            return false;
        const subIndex = group.subscribers.findIndex((s) => s.subscriberId === subscriberId);
        if (subIndex === -1)
            return false;
        const sub = group.subscribers[subIndex];
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
    notify(topic, content, senderId, blackboard) {
        const group = this.subscriptions.get(topic);
        if (!group || group.subscribers.length === 0) {
            return [];
        }
        const conversationId = `notif-${topic}-${Date.now()}`;
        const notification = {
            topic,
            content,
            senderId,
            timestamp: new Date().toISOString(),
            conversationId,
        };
        // 记录通知
        this.notifications.set(conversationId, [notification]);
        const notified = [];
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
    broadcast(content, senderId, blackboard) {
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
    getSubscribers(topic) {
        const group = this.subscriptions.get(topic);
        return group ? [...group.subscribers] : [];
    }
    /**
     * 获取 Agent 的所有订阅。
     */
    getSubscriptionsByAgent(subscriberId) {
        const result = [];
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
    getNotifications(conversationId) {
        return this.notifications.get(conversationId) ?? [];
    }
    /**
     * 获取所有主题。
     */
    listTopics() {
        return Array.from(this.subscriptions.keys());
    }
    /**
     * 获取订阅统计。
     */
    getStats() {
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
    clearTopic(topic) {
        this.subscriptions.delete(topic);
    }
    /**
     * 清除所有订阅。
     */
    clearAll() {
        this.subscriptions.clear();
        this.notifications.clear();
    }
    /**
     * 简单过滤器匹配。
     */
    matchFilter(content, filter) {
        if (typeof content !== "object" || content === null) {
            return false;
        }
        for (const [key, value] of Object.entries(filter)) {
            if (content[key] !== value) {
                return false;
            }
        }
        return true;
    }
}
exports.SubscribeNotifyProtocol = SubscribeNotifyProtocol;
