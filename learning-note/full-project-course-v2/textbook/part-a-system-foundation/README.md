# Part A：先学会判断，再进入调用链

Part A 是整套源码教材的起点。它不要求读者立刻理解 Pi Agent 的内部实现，而是先建立一套稳定的阅读坐标：看到一个用户操作时，能够区分产品入口、Web 编排、窗口生命周期、共享 Core、持久化与桌面进程，不再把“页面上同时发生的事情”误认为“由同一个文件完成”。

## 单元总问题

用户点击首页“头脑风暴”后，看见窗口、欢迎语和输入框。仅凭界面无法回答：谁决定入口类型，谁创建窗口，谁准备 Agent，会话何时真正存在，结果最终保存在哪里？

本单元只先回答“应该怎样给这些责任分层、怎样寻找证据”。HTTP、SSE、会话恢复和工具执行将在 Part B 与 Part E 深入。

## 连续案例

六章始终跟随同一次操作：

```text
首页出现“头脑风暴”
→ 用户点击卡片
→ 页面把入口配置翻译成窗口配置
→ 窗口管理器托管生命周期
→ SkillDialog 成为 Agent 会话入口
→ 读者用源码和测试验证自己的判断
```

## 学完后能够做什么

1. 从用户现象反查第一个配置入口，而不是从最大文件盲读。
2. 区分 package 边界、架构层级与运行进程三个不同维度。
3. 判断一条 import 是否顺着允许的依赖方向。
4. 区分窗口创建、会话初始化、模型调用与磁盘保存。
5. 用“问题—入口—调用者—被调用者—数据—失败—证据”记录一次源码阅读。

## 章节因果链

| 章节 | 新增的判断能力 | 留给下一章的问题 |
| --- | --- | --- |
| [A01](A01-originos-product-and-boundaries.md) | 从产品现象识别系统角色 | 这些角色怎样接力？ |
| [A02](A02-from-user-action-to-system-roles.md) | 区分控制流、数据流与生命周期 | 为什么代码要分散到多个包？ |
| [A03](A03-package-roles-and-dependency-direction.md) | 用职责和依赖方向判断包边界 | 同一包是否等于同一进程？ |
| [A04](A04-runtime-shapes-and-entry-points.md) | 区分 Web、Next 服务端与 Electron 权限 | 如何判断代码放错层？ |
| [A05](A05-architecture-rules-as-reading-compass.md) | 用规约和脚本审查依赖 | 判断怎样转化为可复查证据？ |
| [A06](A06-source-reading-and-verification-loop.md) | 完成一次读、推、查、验闭环 | 进入 Part B 逐段追踪真实链路 |

## 源码覆盖台账

Part A 是概念与方法单元。大文件只登记本单元使用的代码窗口，不宣称整文件已经学完。

| 文件 | 状态 | 代码窗口 | 教学责任 | 验证状态 |
| --- | --- | --- | --- | --- |
| `README.md`、`AGENTS.md` | 精读 | 产品定位、目录与依赖规约 | 建立产品和架构坐标 | 人工对照 |
| `pnpm-workspace.yaml`、根及各包 `package.json` | 精读 | workspace 与 scripts | 区分包和启动形态 | 可执行脚本检查 |
| `packages/web/src/config/homeApps.ts` | 精读 | `HomeAppConfig`、`HOME_APPS` | 入口是配置 | 缺少专门结构测试 |
| `packages/web/src/components/framework/AppCard.tsx` | 精读 | props、`handleClick` | 组件只触发事件 | 缺少直接组件测试 |
| `packages/web/src/app/page.tsx` | 窗口精读 | `handleSkillLaunch`、`HOME_APPS.map` | 页面编排 | 整文件后续逐卡学习 |
| `packages/web/src/services/AppWindowManager.ts` | 窗口精读 | `openWindow`、`openComponentWindow` | 窗口与运行时生命周期 | 缺少直接单测 |
| `packages/web/src/app/window/page.tsx` | 窗口精读 | Skill 原生窗口 query 消费 | 证明 metadata 与 SkillDialog props 不是原样透传 | 缺少原生窗口合同测试 |
| `packages/web/src/store/appWindowStore.ts` | 背景引用 | 窗口集合与重复 id 语义 | 标记真正状态所有者 | Part B 继续精读 |
| `packages/web/src/components/skills/SkillDialog.tsx` | 边界引用 | props 与 `usePiAgent` 入口 | 标出 Part B/E 的停止边界 | Part B 继续精读 |
| `scripts/check-agents-compliance.js`、`eslint-rules/agents-compliance.js` | 精读 | 层级与违规规则 | 规约自动化 | `pnpm agents:check` / `pnpm lint` |

## 完成边界

读完 Part A，不能声称已经掌握 Pi Agent、SSE、工具或会话恢复。能够可靠做到的是：面对一个现象先判断责任层，再找到真实入口，用当前源码和有限测试证据建立可推翻的结论。Part B 将把这套方法用于一条完整用户操作链。

本单元的源码窗口、格式检查、样板对照和未执行验证记录见 [Part A 质量复审台账](QUALITY-REVIEW.md)。
