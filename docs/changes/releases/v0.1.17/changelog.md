# OriginOS CE v0.1.17 Changelog

## 2026-07-24 — docs：归档 Story OS.18 Windows 内置模板技能加载修复

**类型**：docs
**影响模块**：`docs/specs/epic-OS/README.md`, `docs/specs/epic-OS/story-OS.18/**`
**摘要**：Story OS.18 标记为 ✅ Complete，补齐完成归档、实施摘要、测试验证记录和 Epic OS 状态。归档记录覆盖 Windows packaged build 读取 `skill-creator-app`、模板技能不复制到用户 `data/skills`、本地 Windows 包构建验证、`pi-ai` provider 依赖打包和 `verify:win-package` 通过结果。

## 2026-07-24 — fix：Windows 包打入 pi-ai provider 动态依赖

**类型**：fix
**影响模块**：`packages/desktop/scripts/prepare-pi-ai-runtime-deps.js`, `packages/desktop/scripts/build-windows-local.js`, `packages/desktop/scripts/verify-windows-package.js`, `packages/desktop/electron-builder.yml`, `package.json`, `pnpm-lock.yaml`
**摘要**：本地 Windows 构建入口固定为 `pnpm@9.15.9` frozen install，与 GitHub Actions Windows job 对齐；打包前从 `@mariozechner/pi-ai` 实际安装目录收集 109 个动态 provider runtime 依赖并写入 package files，修复安装后 `Cannot find module '@google/genai'`。Windows package verifier 现在会实际 resolve/import Google GenAI、Bedrock、Mistral、proxy-agent 等依赖，避免只校验元数据。

## 验证

- `node packages/desktop/scripts/build-windows-local.js` 通过。
- `pnpm --filter @originos/desktop verify:win-package` 通过。
- `npx pnpm@9.15.9 lint` 通过，存在既有 warning，无 error。
- 本地产物：`release/OriginOS CE-0.1.17-x64.exe`、`release/OriginOS CE-0.1.17-x64.zip`、`release/win-unpacked/`。
