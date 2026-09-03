# Part C：同一份 OriginOS 源码为什么要经过不同工程边界

Part B 已经追完“点击头脑风暴 Skill 到看到流式回复”的用户链路。现在把同一条链路暂时按下暂停键：为什么 `page.tsx` 由 Next.js 处理，Agent 业务可以从 `@originos/core` 导入，Electron 主进程却要编译到 `dist-electron/`？为什么都在一个 Git 仓库里，却不能使用同一套启动、类型检查和打包规则？

Part C 用“修改头脑风暴 Skill 的启动链并验证它能在 Web 开发态与桌面打包态工作”作为连续案例。目标不是背配置字段，而是学会从一条命令反推工作包、配置加载、依赖解析、编译目标、产物位置与失败责任层。

## 单元总问题

当开发者在仓库根执行：

```bash
pnpm dev
```

终端没有“运行整个仓库”。根脚本先选择 `@originos/web`，pnpm 再解析 workspace，Web 包启动 Next.js；Next.js 继续读取 Web 包自己的 TypeScript、Webpack、PostCSS 与 Tailwind 配置。若改为 `pnpm desktop:build`，控制权会进入另一条包含 adapter、Web standalone、Electron TypeScript 和 electron-builder 的流水线。

本单元最终要建立的判断是：

> 仓库根负责组织，package manifest 负责声明，具体工具配置负责解释，构建产物由消费它的运行环境决定。

## 连续案例

全单元保持 Part B 的入口对象：

```json
{
  "entry": "bmad-brainstorming",
  "webPackage": "@originos/web",
  "corePackage": "@originos/core",
  "desktopPackage": "@originos/desktop",
  "adapterPackage": "@originos/pi-agent-adapter"
}
```

这不是一次 API 请求，而是一张工程追踪卡。每章会改变一个条件，例如从 `dev` 改成 `desktop:build`、从 `@originos/core/types` 改成内部相对路径、从源码文件改成生成产物，再观察责任边界怎样变化。

## 章节因果链

| 章节 | 新建立的判断能力 | 直接精读材料 |
| --- | --- | --- |
| [C01](C01-root-package-is-a-command-router.md) | 从根命令找到真正执行包 | 根 `package.json` |
| [C02](C02-workspace-discovers-packages.md) | 区分仓库目录与 workspace 成员 | `pnpm-workspace.yaml` |
| [C03](C03-workspace-protocol-draws-package-edges.md) | 从 `workspace:` 画出包依赖方向 | 六个 package manifest |
| [C04](C04-lockfile-freezes-resolution-not-runtime.md) | 区分版本声明、解析结果与运行成功 | `pnpm-lock.yaml`、patch 声明 |
| [C05](C05-filtered-scripts-select-one-pipeline.md) | 展开根脚本、包脚本和 Turbo 配置 | 根脚本、`turbo.json` |
| [C06](C06-typescript-config-is-an-inheritance-chain.md) | 计算 TypeScript 有效配置 | 根/base/Web/Core/Desktop tsconfig、`next-env.d.ts` |
| [C07](C07-emit-and-noemit-serve-different-consumers.md) | 区分检查源码与生成运行产物 | Core/Web/Desktop tsconfig |
| [C08](C08-package-exports-are-the-public-import-map.md) | 判断公共导入与内部穿透 | Core exports、真实 import |
| [C09](C09-next-config-builds-a-server-and-a-browser.md) | 解释 Next 服务端/浏览器双边界 | `next.config.mjs` |
| [C10](C10-tailwind-and-postcss-transform-styles.md) | 从 className 追到 CSS 产物 | Tailwind/PostCSS 配置 |
| [C11](C11-web-package-is-not-the-whole-product.md) | 划清 Web 包能做与不能做的事 | Web manifest、Next 配置 |
| [C12](C12-electron-dev-runs-three-cooperating-processes.md) | 展开桌面开发的三进程启动顺序 | Desktop manifest、tsconfig |
| [C13](C13-electron-packaging-is-an-explicit-allowlist.md) | 从打包清单判断资源能否随应用发布 | electron-builder 配置 |
| [C14](C14-agent-adapter-and-pi-tasks-are-runtime-packages.md) | 区分源码包与可被 Node 加载的 adapter | Agent、pi-tasks manifest |
| [C15](C15-quality-gates-only-enforce-what-they-can-run.md) | 审核 lint、format、hook 的真实约束 | ESLint、Prettier、pre-commit |
| [C16](C16-tests-have-separate-resolution-worlds.md) | 为失败测试找到正确配置入口 | 三份 Vitest 配置 |
| [C17](C17-generated-artifacts-must-not-become-source.md) | 区分源码、缓存、构建物与发布物 | `.gitignore`、产物检查脚本 |
| [C18](C18-repository-boundary-capstone.md) | 正向展开命令并反向诊断失败 | 全单元综合工作坊 |

## 源码覆盖台账

逐文件差异及 T00 的71个基线文件去向见 [Part C 文件覆盖差异表](COVERAGE.md)。下表只用于呈现章节责任，不替代逐文件状态。

本表中的“精读”表示正文解释具体字段、控制关系和失败后果；“背景”表示只用来连接本章，不在 Part C 冒充逐文件讲完。

| 文件簇 | 状态 | 主讲章节 | 教学责任 | 证据边界 |
| --- | --- | --- | --- | --- |
| 根 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`turbo.json` | 精读 | C01-C05 | 命令、成员、依赖解析与任务图 | 不证明每个依赖都能在当前机器安装 |
| 根、历史 Electron 与包级 TypeScript 配置、Web `next-env.d.ts` | 精读 | C06-C07 | 继承、别名、生成类型入口、emit 与编译目标 | 根 `tsconfig.electron.json` 未找到当前生产调用者 |
| 六个 package manifest | 精读其边界字段 | C03、C11-C14 | package 身份、workspace 边与运行入口 | 各包内部源码留给后续 Part |
| Core `exports` 与样例 import | 精读 | C08 | 公共 API 和内部穿透差异 | 不宣称所有现存导入都符合规约 |
| Next、Tailwind、PostCSS 配置 | 精读 | C09-C10 | Web 构建、双运行环境与样式扫描 | UI 视觉细节留给 Part J |
| Electron package、tsconfig、builder 配置 | 精读 | C12-C13 | 开发编排、编译与打包资源 | 发布签名、更新服务留给 Part K/T20 |
| ESLint、Prettier、Husky | 精读 | C15 | 规则声明与可执行质量门 | 明确记录当前 hook 的脚本缺口 |
| 根/Core/Web/Desktop Vitest 配置 | 精读 | C16 | 测试发现、环境、alias 与 mock | 业务断言由对应业务章节精读 |
| `.gitignore` | 精读相关窗口 | C17 | 产物分类与秘密排除 | 不逐条讲外部工具目录 |
| `scripts/check-root-build-artifacts.js` | 直接精读核心控制流 | C17 | 根目录枚举、过滤、白名单与失败退出 | 嵌套产物扫描仍是缺口 |
| `scripts/check-agents-compliance.js` | 直接精读范围定义，其他函数背景 | C15、C18 | 揭示命令 cwd、路径模型与扫描范围 | 完整逐函数卡留给 T20 |

## 阅读与验收边界

Part C 不解释 Agent 怎样思考，不解释 Core 业务服务怎样保存数据，也不解释 Electron IPC 消息字段；这些分别属于 E/F、D/G 与 K。这里研究的是让这些源码能够被找到、检查、编译和装入正确运行环境的工程边界。

学完后，读者必须能完成两种推演：

- 正向：任选根脚本，写出它选择的 package、下一层脚本、读取的配置、预期产物和停止边界。
- 反向：给定“浏览器可运行但桌面打包缺文件”“编辑器不报错但 Vitest 无法解析别名”“pre-commit 立刻失败”等症状，按证据顺序定位到配置或脚本责任层。

本单元的写作覆盖、格式检查、运行命令和剩余风险记录在 [Part C 写作与验收记录](ACCEPTANCE.md)；它用于审计课程质量，不替代读者自己的练习与口头验收。
