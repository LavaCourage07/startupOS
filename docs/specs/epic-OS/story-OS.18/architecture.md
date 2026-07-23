# 架构设计文档 - Story OS.18

**Story:** Windows 内置模板技能加载修复
**版本:** 1.0
**最后更新:** 2026-07-23

---

## 架构目标

修复 Windows packaged build 中内置模板技能无法加载的问题，同时维持“模板技能不复制到用户 `data/skills`”的目录边界。实现应把 bundled/template skills 作为只读技能源纳入 SkillService，多源解析必须适配 Electron 开发态和打包态。

---

## 已知故障信号

```text
[2026-07-23T10:33:30.230Z] ERROR [SkillService] Get skill content failed
SkillServiceError: Skill "skill-creator-app" not found
```

该错误说明首页配置中的内置 skill id 可以触发查询，但 SkillService 的 source roots 没有在 Windows packaged 环境找到 bundled/template skill。

---

## 影响模块

| 模块 | 文件范围 | 变更方向 |
|------|----------|----------|
| Core 技能加载 | `packages/core/src/lib/integrations/pi-agent/core/skills.ts` 或 SkillService 实现 | 增加 bundled/template source 解析和 source 标识 |
| Core 路径工具 | `packages/core/src/lib/paths.ts` 或 shared path helper | 统一开发态/packaged skill root 计算 |
| Desktop 主进程/服务 | `packages/desktop/src/main/services/**` | 传入 packaged resources path 或初始化 bundled skill roots |
| Desktop 打包脚本 | `packages/desktop/scripts/prepare-*`, `electron-builder.yml` | 确保模板技能进入 package resources |
| Web 配置 | `packages/web/src/config/homeApps.ts` | 确认 `skill-creator-app` id 与 bundled skill 目录一致 |
| 验证脚本 | `packages/desktop/scripts/verify-windows-package.js` | 校验内置技能资源存在 |

---

## 依赖方向

```text
packages/web/src/config/homeApps.ts
  -> SkillDialog / API boundary
  -> @originos/core SkillService public API
  -> core path/source resolver

packages/desktop/src/main/services/*
  -> @originos/core public API
  -> Node/Electron process.resourcesPath

packages/desktop/scripts/*
  -> package resources verification only
```

符合 AGENTS.md：

- Web 页面与组件不直接依赖 Electron main。
- 技能加载主逻辑位于 core 集成层或 feature 公共 API。
- Desktop 只提供 Electron packaged path 适配，不复制 core 业务逻辑。
- 不修改 `dist-electron`、`.next`、`node_modules` 作为源码入口。
- `.claude/skills` 或 `.agents/skills` 等定义目录保持只读，不写入产物。

---

## 数据/API/状态方案

- 不新增数据库。
- 不迁移用户 `data/skills`。
- Skill content API/IPC 返回结果应包含或日志记录 `source: 'user' | 'project' | 'bundled'`，便于验证来源。
- `CLAUDE_SKILL_DIR` 继续指向技能源目录；产物输出仍由 `agentBaseDir` 或调用上下文控制。

---

## 推荐实现策略

### 1. 显式声明 bundled skill roots

建立一个统一函数，例如：

```typescript
resolveBundledSkillRoots(options): string[]
```

候选路径应覆盖：

- 开发态仓库模板技能目录。
- Electron `process.resourcesPath` 下随包分发的模板技能目录。
- `app.asar.unpacked` 或 resources sidecar 中的技能目录。

### 2. SkillService 多源查询

查询顺序必须可测试：

1. project context skill root（如有）
2. user installed skill root（如有）
3. bundled/template skill roots

若现有产品语义要求 user 高于 bundled，应保留该语义；若首页内置 app 强制绑定 bundled source，则必须显式传 source scope，而不是隐式覆盖。

### 3. 打包资源进入 release

Windows package 应包含 bundled/template skills。建议放在 `resources/skills` 或现有资源目录下，避免在运行时从 `data/skills` 复制。

### 4. 日志可诊断

`SkillServiceError` 应包含：

- skill name
- searched roots
- current runtime mode（dev/packaged）
- selected source（成功时 debug）

---

## 性能与安全

- skill root 扫描只读取已知目录，不递归扫描用户整个 home。
- source roots 应做路径归一化和越界保护。
- 单次技能内容读取应保持在 500ms 内。
- bundled/template 目录只读，避免被 Agent 工具写入。
