# 需求文档 - Story OS.18

**Story:** Windows 内置模板技能加载修复
**版本:** 1.0
**最后更新:** 2026-07-23

---

## 需求来源

- 用户反馈：Windows 发布版仍报 `SkillServiceError: Skill "skill-creator-app" not found`。
- 用户要求：内置模板技能不要复制到用户 `data/skills`，但模板技能仍必须能被加载。
- AGENTS.md：技能系统支持 bundled / project / user 多源加载；`data/skills` 是运行时产物目录，不是只读模板源目录。

---

## 详细需求

### FR1: 内置模板技能必须从只读模板源加载

系统内置模板技能应从 packaged resources、app.asar 或明确的 bundled skills 目录加载，不能要求用户 `data/skills/{skillName}` 中存在副本。

**优先级:** High

### FR2: 用户 data/skills 不被模板初始化污染

桌面端首次启动、升级启动、无项目首页加载和内置 skill 打开流程不得把模板技能复制到用户 `data/skills`。

**优先级:** High

### FR3: Windows packaged 路径必须受支持

SkillService 必须在 Windows packaged 环境正确解析模板技能目录，包括：

- `process.resourcesPath` 下的 packaged resources。
- `app.asar` 内或 `app.asar.unpacked` 旁的 bundled resources。
- 开发态仓库路径和 Electron 打包态路径差异。

**优先级:** High

### FR4: 多源加载优先级必须明确

`user`、`project`、`bundled/template` 的优先级必须在代码和测试中明确。若用户或项目存在同名技能，必须按既有产品语义处理，不能因为 bundled fallback 造成静默覆盖或读取错误。

**优先级:** Medium

### FR5: 打包校验必须包含内置技能

Windows package verification 应校验 `skill-creator-app` 等首页内置模板技能存在于最终安装包可访问路径，并能读取 `SKILL.md` 或等价内容入口。

**优先级:** High

---

## 验收标准

### AC1: Windows 发布版能打开内置技能

**Given** 用户安装 Windows 0.1.17 或后续修复版本  
**When** 在无项目首页点击 `skill-creator-app`  
**Then** SkillDialog 成功加载技能内容  
**And** 日志中不出现 `SkillServiceError: Skill "skill-creator-app" not found`

### AC2: 用户技能目录不被模板复制污染

**Given** 用户数据目录不存在 `data/skills/skill-creator-app`  
**When** 启动 Windows 桌面版并打开内置技能  
**Then** `data/skills/skill-creator-app` 仍不存在  
**And** 技能内容来自 bundled/template source

### AC3: 打包资源包含内置模板技能

**Given** CI 生成 Windows package  
**When** 运行 package verification  
**Then** 校验脚本能在最终 package resources 中找到 `skill-creator-app` 的技能定义文件  
**And** 该路径可被运行时 SkillService 使用

### AC4: 开发态与打包态行为一致

**Given** 开发态 `pnpm --filter @originos/desktop build:app` 和 Windows packaged build  
**When** 查询 `skill-creator-app` 内容  
**Then** 两种环境都能返回同一版本的技能内容  
**And** 不依赖 `data/skills` 副本

### AC5: 同名用户技能优先级稳定

**Given** 用户 `data/skills` 中存在同名技能  
**When** SkillService 查询该 skill  
**Then** 返回源必须符合既定优先级  
**And** UI 或日志能区分最终来源，便于排查覆盖问题

---

## 边界条件

- Windows 路径分隔符为 `\`，路径归一化必须使用 Node `path` API。
- packaged app 中 `process.cwd()` 不可靠，不能作为 bundled skill 根目录唯一来源。
- `app.asar` 内文件只读，运行时不得向该目录写产物。
- 用户数据目录不存在时必须自动创建会话/产物目录，但不能创建模板技能目录。
- CDN 安装包与本地构建包都必须通过同一验证脚本或验收步骤。

---

## 异常场景

- bundled 模板技能缺失：启动或 package verify 必须失败并输出缺失 skill 名称。
- bundled 技能存在但 `SKILL.md` 缺失：SkillService 返回明确错误，不回退到空内容。
- 用户同名技能损坏：按优先级尝试后应给出来源和错误，不误报 bundled missing。

---

## 依赖关系

- 依赖技能多源加载实现：`packages/core/src/lib/integrations/pi-agent/core/skills.ts` 或相关 SkillService。
- 依赖桌面 packaged path 适配：`packages/desktop/src/main/**`、`packages/desktop/scripts/**`。
- 依赖首页内置应用配置：`packages/web/src/config/homeApps.ts`。
