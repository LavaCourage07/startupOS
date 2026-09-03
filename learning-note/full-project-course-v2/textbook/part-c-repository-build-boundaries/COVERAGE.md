# Part C 文件覆盖差异表

本表把 T00 的71个基线文件逐一分类。状态只有四种：`直接精读`、`边界引用`、`后续直接精读`、`资产登记`。文件名出现不等于精读；“直接精读”必须能在 C01—C17 找到代码/配置窗口和字段后果。

## 直接精读

| 文件 | 章节 | 当前教学责任 |
| --- | --- | --- |
| `.husky/pre-commit` | C15 | 四段短路、缺失 script、启用证据 |
| `.eslintrc.json` | C15 | error/warn/off 与依赖规则范围 |
| `.gitignore` | C17 | 构建物、运行数据、秘密与清理边界 |
| `.prettierignore`、`.prettierrc.json` | C15 | 格式形状、忽略范围与插件依赖 |
| `package.json` | C01、C05、C15、C17 | 根命令、聚合范围、清理副作用 |
| `pnpm-lock.yaml`、`pnpm-workspace.yaml` | C02、C04 | 成员、安装布局、importer、patch 与解析结果 |
| `tsconfig.base.json`、`tsconfig.json`、`tsconfig.electron.json` | C06 | 继承基线、根配置和平行 Electron 配置 |
| `turbo.json` | C05 | 任务图存在但生产入口未调用 |
| `packages/core/package.json`、`packages/core/tsconfig.json` | C03、C07、C08 | Core 身份、exports 与 emit |
| `packages/desktop/electron-builder.yml`、`packages/desktop/package.json`、`packages/desktop/tsconfig.json` | C05、C07、C12、C13 | 开发、构建、CommonJS 输出与打包白名单 |
| `packages/web/package.json`、`packages/web/tsconfig.json` | C01、C03、C06、C11 | Web 工具入口、依赖与类型范围 |
| `vitest.config.ts`、`packages/core/vitest.config.ts`、`packages/desktop/vitest.config.ts`、`packages/web/vitest.config.ts` | C16 | environment、alias、mock、include 与证据范围 |
| `packages/web/next-env.d.ts`、`packages/web/next.config.mjs` | C06、C09 | Next 类型入口和双 bundle 配置 |
| `packages/web/postcss.config.mjs`、`packages/web/tailwind.config.ts` | C10 | 样式扫描、token、插件顺序 |

## 边界引用：本单元用于比较，但不冒充完整逐文件精读

| 文件 | 本单元用途 | 后续责任 |
| --- | --- | --- |
| `electron-builder.yml` | C13 与 package 级 builder 比较调用者和 cwd | T20 发布配置卡 |
| `postcss.config.mjs`、`tailwind.config.ts` | C10 证明根与 Web 存在平行配置 | T20 根配置卡 |
| `eslint-rules/agents-compliance.js` | C15 识别 ESLint 自定义规则来源 | T20 工具规则卡 |
| `AGENTS.md` | 作为强制架构规范，不作为运行事实 | 全书持续引用 |
| `LINT.md` | 与实际脚本证据对照 | T20 文档证据卡 |

## 后续直接精读：发布、签名、更新与平台脚本

以下文件在 C05、C12、C13 中只承担调用边或停止边界。它们需要在 T20 按函数、分支、失败路径和配对测试分别精读：

- `packages/desktop/scripts/build-windows-local.js`
- `packages/desktop/scripts/bump-release-version.js`
- `packages/desktop/scripts/create-mac-dmg.js`
- `packages/desktop/scripts/generate-update-metadata.js`
- `packages/desktop/scripts/notarize-mac-app.js`
- `packages/desktop/scripts/notify-release-service.js`
- `packages/desktop/scripts/prepare-apple-api-key.js`
- `packages/desktop/scripts/prepare-pi-ai-runtime-deps.js`
- `packages/desktop/scripts/prepare-web-standalone.js`
- `packages/desktop/scripts/publish-all-platforms.js`
- `packages/desktop/scripts/publish-all-v0.1.12.js`
- `packages/desktop/scripts/publish-macos-only.js`
- `packages/desktop/scripts/publish-qiniu-updates.js`
- `packages/desktop/scripts/publish-windows-only.js`
- `packages/desktop/scripts/qiniu-retention.js`
- `packages/desktop/scripts/release-notes.js`
- `packages/desktop/scripts/release-qiniu.js`
- `packages/desktop/scripts/run-electron-builder-mac.js`
- `packages/desktop/scripts/verify-agent-worker-runtime.js`
- `packages/desktop/scripts/verify-apple-notary-credentials.js`
- `packages/desktop/scripts/verify-asar-relative-requires.js`
- `packages/desktop/scripts/verify-mac-package.js`
- `packages/desktop/scripts/verify-mac-signing.js`
- `packages/desktop/scripts/verify-pi-task-runtime-package.js`
- `packages/desktop/scripts/verify-release-artifacts.js`
- `packages/desktop/scripts/verify-update-metadata.js`
- `packages/desktop/scripts/verify-windows-package.js`
- `packages/desktop/scripts/verify-workspace-upload-ipc.js`
- `packages/desktop/scripts/__tests__/qiniu-retention.test.mjs`
- `packages/desktop/scripts/__tests__/verify-pi-task-runtime-package.test.mjs`

## 资产与参考文档登记

| 文件 | 分类理由 | 后续责任 |
| --- | --- | --- |
| `LICENSE` | 法律文本，不按源码解释 | T20 文档/许可卡 |
| `packages/core/tsconfig.tsbuildinfo` | TypeScript 增量缓存，不作为源码入口 | C17 说明生命周期；资产卡登记消费者 |
| `packages/web/public/.gitkeep` | 空目录占位 | Web 静态资源单元登记用途 |
| `CLAUDE.md`、`CODE_OF_CONDUCT.md`、`CONTRIBUTING.md`、`README.md`、`README_CN.md` | 规范、协作或项目说明，不是运行实现 | T20 文档证据卡逐份分类 |

## Part C 额外纳入的工程边界文件

下列文件不在上述 T00 71项中，但被 Part C 的真实命令链直接消费，因此纳入本单元：

- `packages/agent/package.json`、`packages/pi-tasks/package.json`、`packages/service/package.json`：C03、C14 精读 package 身份和运行入口。
- `scripts/check-root-build-artifacts.js`：C17 精读枚举、过滤、白名单和退出分支。
- `scripts/check-agents-compliance.js`：C15 精读扫描范围，其他函数留给 T20。
- `packages/web/src/styles/globals.css`：C10 只精读 Tailwind token 对应变量窗口，完整样式留给 Web UI 单元。

结论：T00 的71个文件均已获得明确状态；Part C 只对表中“直接精读”文件承担完成责任，其余文件已有具体后续轨道，未用目录概览冒充覆盖。
