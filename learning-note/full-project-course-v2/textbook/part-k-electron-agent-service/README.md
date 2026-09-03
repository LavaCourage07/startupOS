# Part K：Electron、Agent 与 Service 包

> 共 30 节。Part K 只讲"Web 以外的运行环境"——Electron 桌面版主进程、IPC 协议与桌面服务层、Agent Worker 运行时与适配器包、Pi-Tasks 运行时合同。Web 版（Part I/J）、Core 业务（Part G）、协作运行时（Part H）不在这里抢跑。

## 课程分段

> 每个大板块都先阅读对应的"单元导读"。导读不替代正式课；它先建立问题、词汇和学习终点，避免在源码细节中失去方向。

Part K 覆盖 108 个 Git 已跟踪文件，分布在四个课程轨道（T13–T16）。正文负责教学，源码覆盖台账负责防止遗漏。

| 范围 | 课号 | 问题 |
| --- | --- | --- |
| Electron 主进程生命周期 | K01–K08 | 先读 [单元导读一](00-01-electron-main-process-guide.md) 。已写： [K01](K01-double-click-starts-an-electron-process.md) 、 [K02](K02-data-root-depends-on-packaged-or-dev.md) 、 [K03](K03-window-manager-owns-native-window-lifecycle.md) 、 [K04](K04-tray-shortcuts-and-auto-update-are-main-process-plugins.md) 、 [K05](K05-console-log-capture-and-daily-log-writer.md) 、 [K06](K06-stream-event-batcher-and-assistant-stream-state.md) 、 [K07](K07-process-health-monitor-watches-event-loop-and-renderer.md) 、 [K08](K08-electron-main-process-workshop.md) 。 |
| IPC 协议与桌面服务层 | K09–K18 | 先读 [单元导读二](00-02-ipc-protocol-and-desktop-services-guide.md) 。 |
| Agent Worker 与适配器 | K19–K25 | 先读 [单元导读三](00-03-agent-worker-and-adapter-guide.md) 。 |
| Pi-Tasks 与 Service 包 | K26–K30 | 先读 [单元导读四](00-04-pi-tasks-and-service-guide.md) 。 |

每一节均以独立文件写入本目录，使用 `K01-...md` 至 `K30-...md` 命名。阅读单节前先用对应单元导读建立整体路径；审查源码覆盖时以全局台账为准，不能用"文件已经列出"代替代码窗口级精读。
