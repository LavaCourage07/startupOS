# V2 全项目课程设计大纲

> 本大纲按课程轨道组织；具体每个文件的唯一单元 ID 在 [全项目文件地图](02-all-tracked-files-map.md) 中。源码文件默认是一张直接精读卡，而不是“被本目录概览覆盖”。

## 学习方式

每条轨道按固定节奏推进：概念课 -> 文件簇导读 -> 逐文件卡 -> 运行实验 -> 复盘。学习者从前往后读时，前一轨道的概念会成为后一轨道的前置条件。

## T00 仓库与工程基础

- 根目录、workspace、包边界、Git 基线、配置加载顺序。
- 所有根配置、根脚本、`scripts/`、`electron/` 进入逐文件地图。

## T01-T03 Core 基础与业务 Feature

- Core package 入口、paths、storage、shared/model、types。
- project、interview、ontology、ontology-data-store、skills、sandbox、culture、taste、document、system、user 配置/注册等 feature。
- 每个 feature 都按 public index -> types -> service -> storage -> tests 的顺序精读。

## T04 Pi Agent Runtime

- 会话、AgentManager、OriginOSAgent、prompt、模型配置、流式消息、工具注册、错误/重试、历史恢复、持久 Agent、Role/Project Agent、认知注入。
- 这是最长主线：每个 tool、hook、runtime policy、测试 fixture 都有直接文件卡。

## T05-T07 Core Modules

- Collaboration runtime：拓扑、supervisor、DAG、协议、黑板、沙箱 worker、观测、UI。
- Memory core：block、recall、archival、embedding/index、provider、工具与兼容层。
- scheduler、neural-channel、view-manager、view-reconciler、browser MCP 等其余模块。

## T08-T12 Web Application

- Next App Router、页面、layout、route 边界。
- 每个 API route 依附其 core service、DTO、错误语义、测试，不独立背 URL。
- 所有 Web 组件、UI primitives、Hooks、stores、services、styles、Web 侧 module adapter。

## T13-T16 Desktop、Agent、Service Packages

- Electron main、preload、IPC、window/tray/shortcuts、desktop services、日志、更新器、renderer adapter。
- `packages/agent` 与 `packages/service` 的 package boundary、导出和构建运行时。

## T17-T20 模板、流程、文档与发布

- 所有 `templates/` 与 Skills：定义、变量、产物边界、运行时装载关系。
- OpenSpec skills 与已有 `openspec/` 文件：变更工作流及 artifact 证据。
- Story/QA/设计/架构文档：区分规范、历史、参考、归档。
- 构建、发布、签名、更新、验证脚本与静态资源消费者。

## 实验主线

1. 从首页入口启动一个 Skill，观察会话、prompt、工具、产物和 UI。
2. 创建项目，完成访谈并生成/读取本体数据。
3. 运行并观察多 Agent collaboration，处理一次 HITL。
4. 通过 API/IPC 做一次最小的 core-backed 修改。
5. 在 desktop 开发态运行、打包验证并复盘资源边界。
6. 用 OpenSpec/Story/测试证据完成一次可审查变更。

## 不允许的完成声明

- 不以课程标题、目录概览或文件链接代替逐文件精读。
- 不以“测试通过”代替运行、练习和口头验收。
- 不以静态课程基线代替新增文件的重新审计。
