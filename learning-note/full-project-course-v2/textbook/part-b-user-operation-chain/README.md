# Part B：一次技能操作怎样穿过系统边界

Part B 使用首页“头脑风暴”作为连续案例，从配置、点击、窗口、Skill 内容、系统提示词、会话创建、消息发送、流式响应，一直追到窗口关闭和磁盘痕迹。重点不是记住函数名，而是能随时回答：控制权在哪里、数据是什么形状、哪一层拥有它、失败后用户会看到什么。

## 单元总问题

用户输入“帮我想三个适合大学生的学习 App 卖点”，最终看到逐段出现的回答，并可能得到一个 Markdown 产物。这个可见结果至少跨过 Web 组件、Web 服务适配、Next API、Core service、Agent runtime 和本地文件系统。任一层失败，表面上都可能只是“窗口没反应”或“回答停住”。

## 连续输入样本

全单元使用同一组身份和数据，避免每章重开案例：

```json
{
  "appId": "app-brainstorming",
  "skillName": "bmad-brainstorming",
  "windowId": "skill-bmad-brainstorming",
  "projectId": "skill-bmad-brainstorming",
  "entryType": "skill",
  "entryId": "bmad-brainstorming",
  "message": "帮我想三个适合大学生的学习 App 卖点"
}
```

这里特意把多个值相同的 id 并排列出。相同字符串不等于相同资源；它们分别属于卡片、窗口、项目范围、会话和入口所有权。

## 章节因果链

| 章节 | 主要边界 |
| --- | --- |
| [B01](B01-home-entry-is-just-config.md) | 配置 → 卡片 |
| [B02](B02-click-to-window.md) | 卡片回调 → 页面 handler |
| [B03](B03-window-manager-is-lifecycle-boundary.md) | 页面 → 窗口状态/原生窗口 |
| [B04](B04-skill-dialog-prepares-session.md) | 窗口 props → 会话准备状态 |
| [B05](B05-skill-content-from-disk-to-ui.md) | 磁盘 Skill → Web/Electron 适配 → UI |
| [B06](B06-skill-md-to-system-prompt.md) | Skill 内容与目录 → system prompt |
| [B07](B07-session-initialization-boundary.md) | 客户端 initialize → API → 会话 JSON |
| [B08](B08-message-ownership-and-runtime-restore.md) | 消息请求 → 所有权校验 → runtime |
| [B09](B09-streaming-response-piece-by-piece.md) | runtime events → SSE/IPC → React state |
| [B10](B10-close-window-vs-delete-session.md) | 关闭窗口 → 销毁 runtime，不删除会话 |
| [B11](B11-artifacts-and-session-storage.md) | 工具上下文 → 产物、会话、认知痕迹 |
| [B12](B12-user-operation-chain-review.md) | 正向推演、反向排错与综合验收 |

## 阅读边界

Part B 对上述文件只精读支撑用户操作链的代码窗口。Pi Agent 内部消息模型、上下文裁剪、工具注册、稳定性策略和完整测试体系属于 Part E；本单元会标出边界并链接真实实现，但不以一章概览冒充整文件精读。

## 源码覆盖总账

| 生产边界 | 本单元状态 | 主讲章节 | 仍不在本单元的内容 |
| --- | --- | --- | --- |
| `homeApps.ts`、`AppCard.tsx`、`page.tsx` | 关键窗口精读 | B01、B02 | 页面其他应用与视觉细节 |
| `AppWindowManager.ts`、`appWindowStore.ts`、`app/window/page.tsx` | 打开、去重、关闭与原生重建精读 | B03、B10 | 拖拽、缩放、Dock 全部实现 |
| `SkillDialog.tsx`、transition guard | 初始化、恢复、prompt 窗口精读 | B04、B06 | 完整渲染与所有交互 |
| Skill renderer adapter、Web route、Desktop handler、Core service | Web/IPC 双入口精读 | B05 | loader 全来源冲突算法 |
| Session renderer adapter、Web route、Desktop handler、Core service | 创建双入口精读 | B07 | 统计、摘要和管理接口 |
| Web messages route、Desktop message/stream handler | 所有权、恢复、流式双入口精读 | B08、B09 | runtime 内部模型循环 |
| Web/Desktop destroy 与 delete | 生命周期与当前路径缺口精读 | B10 | runtime 完整退出协议 |
| Tool context、path utils、working-directory tests | 路径边界精读 | B11 | 每一种工具的内部实现 |

所有“大文件精读”都只表示表中责任窗口。测试文件与生产窗口的对应关系在 B12 和质量复审台账中记录；当前环境不能运行 Vitest，因此测试状态是“已分析断言、未执行”，不是“通过”。

## 验收方式

读者应能用两种方向复述同一条链：

- 正向：给定入口配置，预测每层生成的字段、状态、副作用和返回。
- 反向：给定“卡片可见但无窗口”“窗口有了但不能发送”“消息已保存但无回答”“关闭后历史仍在”等症状，按证据定位责任层。

只有两种方向都能独立完成，Part B 才形成能力闭环。

本单元的逐章能力检查、测试证据范围与当前环境阻断见 [Part B 质量复审台账](QUALITY-REVIEW.md)。
