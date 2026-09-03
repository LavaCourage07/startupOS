# Part J：Web 交互、状态与窗体

> 共 55 节。Part J 只讲 OriginOS Web 包中用户看得见、点得着、拖得动的界面层：首页桌面、应用卡片、窗口框架、Dock、Spotlight、Agent / Skill 会话 UI、项目工作区，以及支撑它们的 Zustand 状态层、业务 Hooks 和服务适配器。Next.js API Route 放在 Part I，Electron 主进程放在 Part K，Core 业务逻辑放在 Part G，都不在这里抢跑。

## 课程分段

> 每个大板块都先阅读对应的“单元导读”。导读不替代正式课；它先建立问题、词汇和学习终点，避免在源码细节中失去方向。

Part J 的源码范围、并行实现、延后主题和复审状态统一记录在每个单元的导读中。正文负责教学，台账负责防止生产路径、测试证据和未接入实现被静默遗漏。

| 单元 | 课号 | 总问题 | 导读与正式课 |
| --- | --- | --- | --- |
| 首页桌面与应用启动 | J01–J09 | 用户打开 OriginOS 后首先看到什么？点击应用卡片后，系统如何决定打开窗口还是启动会话？ | 先读 [单元导读一](00-01-home-and-launcher-guide.md)。已写： [J01](J01-the-home-page-as-an-application-entry.md)、[J02](J02-home-apps-and-system-apps-as-configuration.md)、[J03](J03-app-card-click-pin-delete.md)、[J04](J04-osframework-sidebar-taskbar-statusbar.md)、[J05](J05-top-menu-bar-in-production-path.md)、[J06](J06-desktop-onboarding-and-settings-store.md)、[J07](J07-background-acrylic-and-global-styles.md)、[J08](J08-home-state-loading-and-refresh.md)、[J09](J09-home-and-launcher-workshop.md)。 |
| 窗体系统与窗口状态 | J10–J19 | “窗口”不是浏览器标签页，而是由状态驱动的虚拟窗体。窗口的位置、层级、生命周期由谁管理？Web 与 Electron Native 窗口如何衔接？ | 先读 [单元导读二](00-02-window-system-guide.md)。已写： [J10](J10-app-window-store-state-structure.md)、[J11](J11-app-window-manager-singleton-and-lifecycle.md)、[J12](J12-use-app-window-manager-hook.md)、[J13](J13-app-window-container-rendering.md)、[J14](J14-app-window-component.md)、[J15](J15-window-page-for-native-windows.md)、[J16](J16-electron-native-window-adaptation.md)、[J17](J17-window-position-zindex-minimize-maximize.md)、[J18](J18-window-lifecycle-and-session-cleanup.md)、[J19](J19-window-system-workshop.md)。 |
| Dock、Spotlight 与全局导航 | J20–J27 | Dock、Spotlight、通知、右键菜单如何共享同一份应用状态？又怎样反向驱动窗口管理器？ | 先读 [单元导读三](00-03-dock-spotlight-guide.md)。已写： [J20](J20-dock-store-state-and-persistence.md)、[J21](J21-dock-syncs-with-window-state.md)、[J22](J22-dock-icon-click-drag-long-press.md)、[J23](J23-dock-context-menu-and-animation.md)、[J24](J24-spotlight-store-state-and-index.md)、[J25](J25-spotlight-search-and-global-shortcut.md)、[J26](J26-notification-center-and-global-toasts.md)、[J27](J27-dock-spotlight-workshop.md)。 |
| Agent / Skill 会话界面 | J28–J39 | 打开 Skill 或 Agent 窗口后，输入框、消息列表、思考状态、工具执行结果如何协同呈现？ | 先读 [单元导读四](00-04-agent-skill-ui-guide.md)。已写： [J28](J28-skill-dialog-content-loading-and-prompt.md)、[J29](J29-skill-dialog-session-init-and-switch.md)、[J30](J30-skill-dialog-message-send-and-ui.md)、[J31](J31-agent-dialog-content-structure-and-launcher-init.md)、[J32](J32-agent-dialog-content-history-send-and-ui.md)、[J33](J33-agent-dialog-subcomponents.md)、[J34](J34-agent-host-components.md)、[J35](J35-thinking-process-ui.md)、[J36](J36-agent-lifecycle-hooks.md)、[J37](J37-agent-stores.md)、[J38](J38-skill-execution-and-browser.md)、[J39](J39-agent-skill-ui-workshop.md)。 |
| 项目、访谈与工作区界面 | J40–J48 | 项目创建、访谈、工作区文件管理、本体数据编辑如何在同一窗口框架下挂载不同内容？ | 先读 [单元导读五](00-05-project-workspace-ui-guide.md)。已写： [J40](J40-project-creation-wizard.md)、[J41](J41-interview-window.md)、[J42](J42-interview-panels-and-layout.md)、[J43](J43-legacy-and-skill-interviews.md)、[J44](J44-interview-subcomponents.md)、[J45](J45-ontology-graph.md)、[J46](J46-workspace-entry-and-hooks.md)、[J47](J47-directory-tree-and-file-dialogs.md)、[J48](J48-unit5-summary.md)。 |
| Web 状态层、服务适配与包基础 | J49–J55 | Web 包的状态层、Hooks、服务适配器如何与 Core 能力对接？类型声明、样式、静态资源又有哪些约束？ | 先读 [单元导读六](00-06-web-state-and-foundation-guide.md)。已写： [J49](J49-remaining-stores-and-hooks.md)、[J50](J50-view-reconciler-and-agent-hooks.md)、[J51](J51-shared-ui-primitives.md)、[J52](J52-chat-components.md)、[J53](J53-service-adapters.md)、[J54](J54-package-foundations.md)、[J55](J55-unit6-summary.md)。 |

每一节均以独立文件写入本目录，使用 `J01-...md` 至 `J55-...md` 命名。阅读单节前先用对应单元导读建立整体路径；审查源码覆盖时以单元台账为准，不能用“文件已经列出”代替代码窗口级精读。
