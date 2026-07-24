# OriginOS CE v0.1.19 Changelog

## 2026-07-24 — fix：修复 Windows 安装态内置 skill 加载

**类型**：fix
**影响模块**：`packages/core/src/lib/features/services/launcher/skill.ts`, `packages/desktop/scripts/verify-windows-package.js`
**摘要**：修复官网 0.1.18 Windows 安装包中模板技能资源存在，但 `SkillLauncher` 在安装态只扫描第一个 bundled skill root，导致 `skill-creator-app` 报 not found 的问题。Launcher 现在会遍历所有 bundled skill root，Windows package verifier 会检查编译后的 runtime 包含该 fallback 逻辑。

## 验证

- `pnpm --filter @originos/core test -- --run src/lib/features/services/launcher/__tests__/skill-launcher.test.ts`
- `pnpm --filter @originos/core test -- --run src/lib/integrations/pi-agent/__tests__/skills.test.ts`
- `pnpm lint`
