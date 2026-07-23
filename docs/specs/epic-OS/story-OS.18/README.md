# Story OS.18: Windows 内置模板技能加载修复

**Epic:** OS - Phase 0 OS 交互基础
**Status:** Planning
**Owner:** Product / Engineering
**Created:** 2026-07-23
**Last Updated:** 2026-07-23

---

## Story 概览

### User Story

作为 Windows 桌面版 OriginOS 用户，
我希望首页内置模板技能即使不复制到用户 `data/skills` 目录也能正常打开，
以便系统内置技能既不会污染用户运行时技能目录，也不会在打包版本中报 `Skill "skill-creator-app" not found`。

### 背景与问题

- 当前 Windows 版本日志出现：
  `SkillServiceError: Skill "skill-creator-app" not found`
- 近期调整已停止把模板技能复制到用户 `/data/skills`，这符合运行时数据目录边界。
- 但内置模板技能仍需要作为 bundled/template source 被 SkillService 加载，不能依赖用户目录存在副本。
- 问题集中在 Windows 打包版本，必须覆盖 Electron packaged 路径、asar/resources 路径和技能多源解析顺序。

### 验收标准（简要）

- [ ] AC1: Windows packaged build 中点击 `skill-creator-app` 能成功加载技能内容，不再报 not found。
- [ ] AC2: 首次启动和升级启动都不会把模板技能复制到用户 `data/skills`。
- [ ] AC3: SkillService 多源加载顺序包含 bundled/template skills，并能在 Electron packaged 环境解析真实路径。
- [ ] AC4: 用户 `data/skills` 中同名技能如存在，应按既定优先级处理，不能被模板源静默覆盖。
- [ ] AC5: 自动化或脚本化验收覆盖 Windows 打包资源、技能内容 API/IPC、用户目录不污染。
- [ ] AC6: 本地必须构建出 Windows 安装包或 `win-unpacked`，并完成安装/启动级验证后才能关闭 Story。

---

## 文档导航

- [需求文档](./requirements.md)
- [交互设计](./interaction.md)
- [架构设计](./architecture.md)
- [开发文档](./implementation.md)
- [测试文档](./testing.md)
- [返回 Epic OS](../README.md)

---

## 进度跟踪

- [x] Story 文档创建
- [ ] 问题复现与路径定位
- [ ] 实施
- [ ] 本地 Windows 包构建与启动验证
- [ ] 发布链路验证

---

## 变更历史

| 日期 | 变更内容 | 变更人 |
|------|---------|--------|
| 2026-07-23 | 创建 Windows 内置模板技能加载 bugfix Story | Codex |
