# 测试文档 - Story OS.18

**Story:** Windows 内置模板技能加载修复
**版本:** 1.0
**最后更新:** 2026-07-23

---

## 测试目标

验证 Windows packaged build 能加载内置模板技能 `skill-creator-app`，同时确认模板技能不会复制到用户 `data/skills`。

---

## 自动化与脚本化测试用例

### TC1: bundled skill root resolver 覆盖 Windows packaged path

**类型:** 单元测试  
**覆盖:** AC1, AC3, AC4

**Given** mock `resourcesPath` 指向 Windows package resources  
**When** 调用 bundled skill root resolver  
**Then** 返回的 roots 包含 packaged bundled skills 目录  
**And** 路径归一化后能定位 `skill-creator-app/SKILL.md`

### TC2: SkillService 未命中 user/project 后读取 bundled source

**类型:** 单元测试  
**覆盖:** AC1, AC4

**Given** user skills 和 project skills 中都没有 `skill-creator-app`  
**When** 调用 `getSkillContent('skill-creator-app')`  
**Then** 返回 bundled/template source 中的技能内容  
**And** 返回或日志中的 source 为 `bundled`

### TC3: 不复制模板技能到 data/skills

**类型:** 集成测试或脚本化验收  
**覆盖:** AC2

**Given** 临时用户数据目录为空  
**When** 启动桌面服务并打开 `skill-creator-app`  
**Then** `data/skills/skill-creator-app` 不存在  
**And** 技能内容仍能成功返回

### TC4: Windows package resources 包含内置技能

**类型:** package verification  
**覆盖:** AC3, AC6

**Given** 本地构建生成 `release/win-unpacked` 和 Windows zip/exe  
**When** 运行 `pnpm --filter @originos/desktop verify:win-package`  
**Then** 校验脚本确认 package resources 中存在 `skill-creator-app/SKILL.md`  
**And** Windows zip 中也包含对应 bundled skill 文件

### TC5: 本地 Windows 包启动 smoke

**类型:** Playwright/Electron smoke 或手工脚本化验收  
**覆盖:** AC1, AC2, AC6

**Given** 本地构建出的 Windows 安装包或 `win-unpacked` 首次启动且无项目  
**When** 点击首页 `skill-creator-app` AppCard  
**Then** SkillDialog 打开并显示技能说明或初始提示  
**And** 用户数据目录没有生成 `data/skills/skill-creator-app`  
**And** 日志中不出现 `Skill "skill-creator-app" not found`

### TC6: 用户同名技能优先级

**类型:** 单元测试  
**覆盖:** AC5

**Given** user skills 与 bundled skills 都存在 `skill-creator-app`  
**When** 按默认 scope 查询技能  
**Then** 返回来源符合既定优先级  
**And** 测试断言 source 字段或可观测日志

### TC7: CDN 安装包回归验收

**类型:** 发布后验收  
**覆盖:** AC1, AC2, AC3

**Given** GitHub Actions 发布成功并上传 Windows 包到七牛  
**When** 从官网/CDN 下载并安装 Windows 包  
**Then** 打开 `skill-creator-app` 成功  
**And** 用户数据目录没有模板技能副本  
**And** release log 没有 SkillService not found 错误

---

## 必跑命令

```bash
pnpm lint
pnpm --filter @originos/desktop build:app
pnpm --filter @originos/desktop dist:win
pnpm --filter @originos/desktop verify:win-package
```

如实现新增 core 单元测试，还必须运行对应 `vitest` 测试命令。
验收关闭前必须使用本地构建出的 Windows 包完成启动级验证，不能只通过源码开发态或 CI 日志判断。

---

## 人工验证步骤

1. 使用最新 Windows 安装包覆盖安装。
2. 删除或重命名用户数据目录中的 `data/skills/skill-creator-app`，确保没有副本。
3. 启动应用，进入无项目首页。
4. 点击 `skill-creator-app`。
5. 确认 SkillDialog 正常展示技能内容。
6. 检查日志中没有 `SkillServiceError: Skill "skill-creator-app" not found`。

---

## 剩余风险

- 若用户历史目录中已有同名损坏技能，默认优先级可能仍读取用户源并失败，需要实现时明确降级策略。
- macOS/Linux packaged path 可能与 Windows 不同，建议将 resolver 测试做成跨平台路径矩阵。
