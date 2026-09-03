# C02：目录放进 `packages/`，还不等于进入 workspace

## 一个 filter 为什么能找到 Web

C01 看到根脚本使用 `--filter @originos/web`。pnpm 要先知道哪些目录属于同一个 workspace，才可能读取其中的 package 名称。这个成员集合不是通过“看起来像 monorepo”猜出来的，而由 [pnpm workspace 配置](../../../../pnpm-workspace.yaml#L1) 声明。

本章只研究成员发现与安装布局，不把每条 package 依赖展开；包间依赖图在 C03 完成。

## 直觉：workspace 是名单规则，不是文件夹昵称

`packages/*` 是一条 glob 规则：匹配 `packages` 下一级目录。一个目录同时满足“被 glob 匹配”和“含有效 `package.json`”，才成为 pnpm 可识别的 workspace package。仓库中的 `templates/`、`docs/` 和 `data/` 并不会因为同处根目录就自动变成 package。

```mermaid
flowchart LR
    A[pnpm-workspace.yaml] -->|读取 packages glob| B[packages/*]
    B --> C[web package.json]
    B --> D[core package.json]
    B --> E[desktop package.json]
    B --> F[agent pi-tasks service]
    C -->|读取 name| G[@originos/web]
```

第一根箭头建立扫描规则；中间箭头匹配目录；最后一根箭头从 manifest 得到 filter 使用的 package 名。没有 `name` 或 manifest 无效时，目录路径本身不能替代 package 身份。

## 第一段源码：成员范围只有一行，却决定六个包

[pnpm-workspace.yaml 第 1—2 行](../../../../pnpm-workspace.yaml#L1)：

```yaml
packages:
  - packages/*
```

当前 `pnpm list -r --depth -1` 识别出：`@originos/web`、`@originos/core`、`@originos/desktop`、`@originos/pi-agent-adapter`、`@originos/pi-tasks` 与 `@originos/service`。这是当前 checkout 的运行证据，而不是由教程臆测的固定数量。未来新增 `packages/foo/package.json` 后，成员数会变化。

## 第二段源码：`nodeLinker: hoisted` 改的是安装布局

[pnpm-workspace.yaml 第 4—7 行](../../../../pnpm-workspace.yaml#L4) 记录了 Electron 构建产物的运行时解析问题，并选择 `nodeLinker: hoisted`。直觉上，它把依赖更集中地放到上层 `node_modules`，便于编译后的深层文件按 Node 规则向上找到依赖。

这个选项负责**依赖在磁盘上的布局**，不负责：

- 给未声明的依赖补合同；
- 保证打包清单把依赖复制进最终应用；
- 修复浏览器不能使用 Node API 的问题；
- 把任意相对 import 变成公共 package import。

把 hoist 写成“依赖安全可用”会超过源码保证。它只改变解析机会，不改变模块责任。

## 第三段源码：跨平台二进制是安装输入

[pnpm-workspace.yaml 第 9—35 行](../../../../pnpm-workspace.yaml#L9) 同时声明：

- `supportedArchitectures` 覆盖 darwin、linux、win32 与 arm64、x64；
- `overrides` 固定 `@electron/get`；
- `allowBuilds` 允许一组依赖执行构建脚本；
- `onnxruntime-node` 被明确设为不构建，并进入 `ignoredBuiltDependencies`。

这些字段影响安装阶段选择和生命周期脚本。它们不保证 Windows 包已在 macOS 上实际验收，也不保证某 native 模块最终能加载。C13 会继续检查哪些文件进入 Electron 包。

## 逐字段精读安装策略

### `supportedArchitectures` 是“准备哪些候选”，不是“已经运行在哪些平台”

`os` 与 `cpu` 形成候选组合。配置包含 darwin/linux/win32 与 arm64/x64，目的是让安装阶段可以保留开发/发布需要的 optional binary。它不会在一台 macOS 机器上模拟 Windows，也不会验证某依赖真的为六种组合都提供构建物。

如果 Windows 发布物缺 native runtime，证据链应是：lockfile 是否含目标 optional 包 → node_modules/打包准备目录是否有目标平台文件 → builder 是否复制 → Windows 进程是否能加载。只看到 `supportedArchitectures.win32` 只能确认第一步的安装意图。

### `overrides` 改的是解析选择

`'@electron/get': 5.0.0` 会在依赖图解析时覆盖下游请求的版本。这样可以统一 Electron 下载工具，却可能与某个上游声明的范围产生兼容风险。正确验证包括重新安装后的 lockfile 结果和 Electron 下载/打包命令；字段存在不能证明新版本与所有调用者兼容。

### `allowBuilds` 是生命周期脚本许可表

某些依赖安装时需要编译 native 扩展或生成平台文件。allowBuilds 把“哪些包允许执行 build script”显式化。`onnxruntime-node: false` 再配合 ignoredBuiltDependencies，表示当前策略刻意不让它在安装阶段构建。

这不是通用 sandbox。允许一个 package build 并不审计它的脚本内容；禁止 build 也不表示包永远不可用——项目可能复制预构建 binary。安全与可用性都要继续看具体依赖和打包链。

## workspace 成员发现的伪算法

用接近源码的方式描述 pnpm 需要完成的工作：

```text
读取 workspace 根配置
for 每条 packages glob:
  展开匹配目录
  若目录存在有效 package.json:
    读取 name 与 version
    将其加入 workspace graph
解析每个 manifest 的 workspace: specifier
建立 link 与 lock importer
```

这段伪算法不是 pnpm 内部实现的逐行复刻，而是本章证据足以支持的最小模型。它帮助预测输入变化：新增目录、修改 glob、破坏 manifest、重名 package、版本不匹配分别在哪一步失败。

## 两个边界案例

### 案例一：目录匹配，但没有 manifest

`packages/design-assets/` 只有图片。glob 能匹配目录，但没有 package manifest，pnpm 没有 package name、version 和 scripts 可登记。它仍是仓库资源目录，却不是一个可 `--filter` 的 package。

### 案例二：两个 manifest 使用相同 name

目录路径不同也不能让 filter 安全区分同名包。workspace 身份以 manifest name 为核心；重复会在安装/图构建阶段造成冲突。正确恢复是修改 package 身份与所有 workspace 依赖，而不是把 filter 写成模糊路径绕过去。

## `nodeLinker` 改变了什么磁盘观察

在 isolated 布局里，package 的可见依赖通常更严格地通过 pnpm 链接组织；hoisted 布局会把更多包放到上层 node_modules。于是 Node 从 `dist-electron/desktop/src/main` 向上寻找时，更可能在仓库根命中依赖。

但这也可能掩盖“代码导入了未在自身 manifest 声明的包”。本地 hoisted 环境能运行，发布/另一安装策略却失败。诊断时应同时问：磁盘上能否解析，以及哪个 manifest 对这条依赖负责。

## 正常、失败与恢复状态表

| 状态 | workspace 列表 | 安装布局 | 后续命令 |
| --- | --- | --- | --- |
| 正常成员 | 出现在递归列表 | 依策略链接/hoist | 可继续查 script |
| glob 漏掉 | 不出现 | 不作为本地包链接 | filter 先失败 |
| manifest 损坏 | 配置读取报错 | 安装中止或图不完整 | 修 JSON 后重算 |
| 依赖 build 被拒 | 成员仍可能存在 | 目标生成物缺失 | 调整许可或使用预构建物 |
| 目标平台 binary 未准备 | 列表正常 | 当前平台或目标包缺文件 | 补安装/打包验证 |

## 具体输入推演：新增一个工具包

假设创建 `packages/diagnostics/package.json`：

```json
{ "name": "@originos/diagnostics", "private": true }
```

在不修改 glob 的情况下，它会被 `packages/*` 匹配。若改放到 `tools/diagnostics/`，则不会自动成为成员。若目录匹配但 `package.json` JSON 损坏，workspace 发现会在进入包脚本前失败；这与包内部 TypeScript 错误属于不同阶段。

## 失败诊断：filter 找不到包

按以下顺序排查：

1. `pnpm list -r --depth -1` 是否列出目标包？若没有，先查 glob 与 manifest。
2. manifest 的 `name` 是否与 filter 完全一致？目录名 `web` 不等于 package 名 `@originos/web`。
3. 命令是否从 workspace 根执行？从孤立目录执行时，配置发现边界可能不同。
4. 只有成员和名称都正确，才检查包内是否存在目标 script。

这一顺序能把“成员未发现”“名称不匹配”“脚本缺失”三个症状相近的错误分开。

## 验证证据与缺口

当前 package 列表证明 glob 与六份 manifest 可以被 pnpm 解析。没有在本章执行重新安装，因此 `nodeLinker`、跨平台 optional binary 和 allowBuilds 的实际安装效果未被现场验证；正文对它们的判断来自配置语义和注释，不能替代干净环境安装测试。

更完整的验收应分三层：

- 静态层：解析 YAML，断言成员 glob、nodeLinker 与平台清单。
- 安装层：在干净缓存/临时目录执行 frozen install，检查退出码与 lockfile 无漂移。
- 运行层：在 Desktop 编译产物位置解析关键依赖，并在目标 OS 启动。

第一层通过不能替代第二、三层。本章实际完成的是成员列表运行检查与配置精读，后两层明确保留为构建/发布验证。

## 源码实验室：目录匹配、安装布局与脚本许可不是一件事

成员发现只由 [pnpm-workspace.yaml 第 1—2 行](../../../../pnpm-workspace.yaml#L1) 的 glob 开始：

```yaml
packages:
  - packages/*
```

pnpm 会把 `packages/` 下一层、且含有效 manifest 的目录视为候选工作包。glob 不读取 AGENTS.md 的层级含义，也不会因目录叫 `core` 就赋予特殊权限。`packages/service` 能被发现，是因为路径匹配且存在 `package.json`；它是否可运行，还要另查 scripts 与入口。

安装布局来自另一个活动字段，见 [pnpm-workspace.yaml 第 4—7 行](../../../../pnpm-workspace.yaml#L4)：

```yaml
# Electron 主进程产物在 dist-electron/ 下，运行时向上解析 node_modules；
# pnpm 默认 isolated 模式不 hoist，导致 zod 等依赖解析失败。
nodeLinker: hoisted
```

这里的输入是安装器准备建立的依赖图，输出是更平铺的 `node_modules` 布局。它改变“运行时从父目录能否找到包”，但不向任何 manifest 增加 dependency；若代码依赖未声明，只因 hoist 偶然可见，仍然是脆弱的隐式依赖。

最后看 [pnpm-workspace.yaml 第 24—35 行](../../../../pnpm-workspace.yaml#L24)：

```yaml
allowBuilds:
  '@google/genai': true
  canvas: true
  esbuild: true
  onnxruntime-node: false

ignoredBuiltDependencies:
  - onnxruntime-node
```

`allowBuilds` 决定安装阶段哪些依赖生命周期脚本获准执行；`onnxruntime-node: false` 与 ignored 列表共同表达“不要在常规安装中构建它”。这不等于代码永远不会加载该包，仓库仍可能通过单独的修复或打包流程准备 native runtime。

### 从失败现象反推

若 filter 报找不到项目，检查顺序应是：目录是否匹配 glob → manifest 是否存在且 JSON 合法 → `name` 是否精确等于 filter → package 是否声明目标 script。若错误发生在 native postinstall，则成员发现已经成功，责任层应转到架构候选和 build 许可。

### 测试证据边界

`pnpm list -r --depth -1` 能证明当前安装器发现了哪些工作包，不能证明每个包的依赖闭合、脚本可运行或 Electron 打包可用。仓库当前没有固定 workspace 成员集合的测试。

## 小实验与口头验收

1. 预测 `packages/core/src/modules/foo/package.json` 是否会被 `packages/*` 直接匹配，说明 glob 层级。
2. 解释为什么 hoisted 能帮助某些运行时解析，却不能替代 package `dependencies`。
3. 为“filter 无匹配”写出三步证据顺序，不能直接把原因归结为 pnpm 损坏。
4. 迁移练习：若成员规则改成 `packages/**`，可能意外把哪些嵌套模块纳入 workspace？

### 实验参考推演

第1题：`packages/core/src/modules/foo` 位于多层子目录，`packages/*` 只匹配 `packages` 下一层，不能直接把 foo 纳为 workspace 成员；Core 本身因 `packages/core` 被匹配。

第2题：hoisted 改善 Node 向上解析的磁盘机会，manifest 依赖则声明所有权。前者可能掩盖漏声明，不能替后者。

第3题的顺序应是递归列表 → manifest name → 执行 cwd → 目标 script。若列表没有包，先修成员发现；不要进入业务源码。

第4题：`packages/**` 可能把 `packages/core/src/modules/mcp-in-browser` 等带 package.json 的嵌套模块也识别为 workspace 成员，改变 lockfile importers、script 递归和依赖图。是否需要纳入必须有明确设计。

## 源码阅读顺序

1. 读 workspace 第 1—2 行，自己列出匹配的一级目录。
2. 对照六份 package manifest 的 name/version，而非只看目录名。
3. 读第 4—7 行安装布局注释和 nodeLinker。
4. 读第 9—22 行平台与 override，区分候选平台和解析覆盖。
5. 读第 24—35 行 build 许可，标出 true/false/ignore 三种状态。
6. 最后用 lockfile importers 验证成员视角；不要从庞大 snapshot 开始。

暂时跳过每个 native 依赖内部安装脚本；那需要依赖源码和目标平台日志，本章只把它们登记为安装边界。

## 迁移验收：把嵌套模块变成正式成员

若确实要将 `packages/core/src/modules/view-manager` 作为独立 workspace 成员，不能只扩大 glob。还需确认它的 manifest 身份不冲突；决定 Core/Web 是 workspace 依赖还是源码 alias；调整 TypeScript/Vitest/Next 解析；处理 lockfile importer；定义 build/test；验证不会同时从两条路径加载两份模块状态。

如果同一库既被 Web alias 到源码，又以 node_modules package 加载，singleton/store 可能产生双实例。这项迁移题把“成员发现”连接到真实运行后果。

下一课把成员从“名单”变成“有方向的依赖图”：哪些 package 通过 `workspace:` 明确依赖了另一个本地 package？
