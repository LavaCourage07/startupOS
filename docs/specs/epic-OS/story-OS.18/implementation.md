# 开发文档 - Story OS.18

**Story:** Windows 内置模板技能加载修复
**版本:** 1.0
**最后更新:** 2026-07-24

---

## 开发目标

让 Windows packaged build 在不复制模板技能到用户 `data/skills` 的前提下，稳定加载首页内置模板技能 `skill-creator-app`。

---

## 文件级改动范围

### 必查

- `packages/web/src/config/homeApps.ts`
- `packages/core/src/lib/integrations/pi-agent/core/skills.ts`
- `packages/core/src/lib/features/skills/**`（如 SkillService 位于此处）
- `packages/core/src/lib/paths.ts`
- `packages/desktop/src/main/services/**`
- `packages/desktop/electron-builder.yml`
- `packages/desktop/scripts/prepare-web-standalone.js`
- `packages/desktop/scripts/verify-windows-package.js`

### 禁止作为修复入口

- `packages/desktop/dist-electron/**`
- `packages/web/.next/**`
- `packages/*/node_modules/**`
- 用户 `data/skills/**` 中的生成副本

---

## 实施步骤

### 步骤 1: 复现和定位 source roots

- 在 Windows 发布版或等价 `win-unpacked` 环境打开 `skill-creator-app`。
- 打印 SkillService 查询的 source roots。
- 确认 `skill-creator-app` 在 package resources 中实际位置。
- 确认用户 `data/skills` 中不存在模板副本。

### 步骤 2: 对齐首页配置和技能目录名

- 检查 `homeApps.ts` 中 skillName/id 是否为 `skill-creator-app`。
- 检查 bundled/template skills 目录是否存在同名目录和 `SKILL.md`。
- 若存在命名别名，增加显式 alias 映射，并覆盖测试。

### 步骤 3: 建立 bundled/template skill root resolver

- 在 core 或 desktop 适配边界实现 packaged-safe path resolver。
- 对 Windows 路径使用 `path.resolve`、`path.join` 和 slash normalization。
- 不依赖 `process.cwd()` 作为打包态唯一根。

### 步骤 4: SkillService fallback 到 bundled/template source

- 保留 project/user source 逻辑。
- 在未命中 user/project 时查 bundled/template source。
- 成功返回技能内容时记录 source。
- 未命中时返回包含 searched roots 的错误。

### 步骤 5: 打包资源声明

- 确认 electron-builder files/extraResources 包含模板技能目录。
- 如资源当前只在 `.agents/skills` 或 `templates/skills`，选择一个 canonical bundled source 并打包。
- 不把该目录复制到用户 `data/skills`。

### 步骤 6: 验证脚本加固

- `verify-windows-package.js` 增加对 `skill-creator-app/SKILL.md` 的资源检查。
- 增加一个 Node smoke：模拟 packaged resources root，调用 SkillService 读取 `skill-creator-app` 内容。
- 若直接调用 SkillService 需要 Electron 上下文，可新增纯函数 path resolver 单元测试。

### 步骤 7: 本地 Windows 包验证

- 在本地构建 Windows 包，至少生成 `release/win-unpacked`，推荐同时生成 NSIS exe。
- 使用本地包启动应用，不能只验证源码开发态。
- 使用干净或临时用户数据目录启动，确认不会生成 `data/skills/skill-creator-app`。
- 点击首页 `skill-creator-app` 并确认 SkillDialog 能读取内置技能内容。
- 检查运行日志中没有 `SkillServiceError: Skill "skill-creator-app" not found`。

### 步骤 8: 发布验证

- 本地 Windows package 验证通过。
- GitHub Actions Windows build 和 publish 通过。
- CDN 下载 Windows 包安装后，首次打开 `skill-creator-app` 不报 not found。

---

## 兼容策略

- 不迁移或删除用户现有 `data/skills`。
- 若用户已有同名 skill，按既定优先级读取。
- 升级安装后不生成模板技能副本；旧版本已生成的副本不在本 Story 自动清理，除非确认安全。

---

## 审查要点

- 是否有任何路径仍假设模板技能必须在 `data/skills`。
- 是否把 bundled/template skills 写入用户数据目录。
- Windows packaged path 是否只在 desktop 适配层处理。
- SkillService 错误日志是否足以定位 searched roots。
- CI package verify 是否能防止后续发布再次缺内置技能。

---

## 实施完成记录

**状态:** ✅ Complete
**完成日期:** 2026-07-24

### 已完成改动

- `packages/core/src/lib/integrations/pi-agent/core/skills.ts` 增加 packaged-safe bundled skill roots，覆盖 Electron packaged `process.resourcesPath/templates/skills`。
- `packages/desktop/scripts/verify-windows-package.js` 增加 `skill-creator-app/SKILL.md` package resource 校验和运行时模块 smoke。
- `packages/desktop/scripts/prepare-pi-ai-runtime-deps.js` 收集 `@mariozechner/pi-ai` 动态 provider 依赖，并在 Windows package 中打入 `@google/genai` 等运行时包。
- `packages/desktop/scripts/build-windows-local.js` 固定本地 Windows 构建为 pnpm 9.15.9 frozen install，与 GitHub Actions Windows job 对齐。
- `packages/desktop/electron-builder.yml` 将 `.packaging/pi-ai-runtime/node_modules` 作为 package files 输入。

### 兼容性结论

- 模板技能仍作为只读 bundled/template source 加载，不复制到用户 `data/skills`。
- 用户/project/bundled 多源加载优先级保持既有语义，bundled source 仅作为内置模板技能可读源。
- Windows 本地包和 CI 包使用同一 package verification，防止后续再次出现 bundled skill 或 provider 依赖缺失。
