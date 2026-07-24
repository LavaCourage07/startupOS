# Story OS.18: Windows 内置模板技能加载修复

**Epic:** OS - Phase 0 OS 交互基础
**Status:** ✅ Complete
**Owner:** Product / Engineering
**Created:** 2026-07-23
**Last Updated:** 2026-07-24

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

- [x] AC1: Windows packaged build 中点击 `skill-creator-app` 能成功加载技能内容，不再报 not found。
- [x] AC2: 首次启动和升级启动都不会把模板技能复制到用户 `data/skills`。
- [x] AC3: SkillService 多源加载顺序包含 bundled/template skills，并能在 Electron packaged 环境解析真实路径。
- [x] AC4: 用户 `data/skills` 中同名技能如存在，应按既定优先级处理，不能被模板源静默覆盖。
- [x] AC5: 自动化或脚本化验收覆盖 Windows 打包资源、技能内容 API/IPC、用户目录不污染。
- [x] AC6: 本地必须构建出 Windows 安装包或 `win-unpacked`，并完成安装/启动级验证后才能关闭 Story。

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
- [x] 问题复现与路径定位
- [x] 实施
- [x] 本地 Windows 包构建与启动验证
- [x] 发布链路验证

---

## 后续 Bugfix TODO

- [ ] Windows 自动更新失败：用户侧更新时报 `sha512 checksum mismatch`。
  - 现象：自动更新下载到的 Windows 安装包或 blockmap 与 `latest.yml` / `stable.yml` 中记录的 `sha512` 不一致。
  - 初步排查方向：确认七牛资源包、blockmap、`latest.yml`/`stable.yml` 是否同批次全量覆盖；确认 CDN 缓存是否仍返回旧 exe/zip/blockmap；确认发布脚本在覆盖同版本资源后重新生成并上传匹配的 metadata。
  - 验收要求：发布后必须逐个校验 metadata 中 URL 可访问，并计算远端资源 `sha512` 与 metadata 完全一致；Windows 客户端自动更新不再出现 checksum mismatch。

---

## 完成归档

**完成日期:** 2026-07-24
**代码提交:** `b6468e1`, `d6e373b`
**归档提交:** 本次 Story 归档提交

### 实施摘要

- SkillService bundled/template skill resolver 已支持 Windows packaged resources path，内置技能不再依赖用户 `data/skills` 副本。
- Windows package verification 已覆盖 `templates/skills/skill-creator-app/SKILL.md`，并增加 packaged runtime smoke。
- 本地 Windows 构建入口固定为 `pnpm@9.15.9` frozen install，与 GitHub Actions 步骤对齐。
- Windows package 显式打入 `@mariozechner/pi-ai` 动态 provider 运行时依赖，避免 `Cannot find module '@google/genai'`。

### 验证摘要

- `node packages/desktop/scripts/build-windows-local.js` 通过。
- `pnpm --filter @originos/desktop verify:win-package` 通过。
- 生成并验证 `release/OriginOS CE-0.1.17-x64.exe`、`release/OriginOS CE-0.1.17-x64.zip`。
- `npx pnpm@9.15.9 lint` 通过，存在既有 warning，无 error。

---

## 变更历史

| 日期 | 变更内容 | 变更人 |
|------|---------|--------|
| 2026-07-24 | 完成 Story OS.18 实施、Windows 本地包验证与归档 | Codex |
| 2026-07-23 | 创建 Windows 内置模板技能加载 bugfix Story | Codex |
