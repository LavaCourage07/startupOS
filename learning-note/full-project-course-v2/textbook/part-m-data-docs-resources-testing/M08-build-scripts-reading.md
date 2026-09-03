# M08 构建脚本如何阅读——从 `package.json` 到构建产物的完整链路

小林想本地构建 OriginOS 的桌面版。她看到根目录的 `package.json` 里有 `desktop:build` 脚本，就运行了 `pnpm desktop:build`。命令执行了 5 分钟后报错：`electron-builder` 找不到 `electron-builder.yml` 配置文件。

她困惑了：`package.json` 里明明写了 `desktop:build` 调用 `build:app`，为什么还会报错？她没有意识到的是：**构建脚本不是单条命令，而是一个有依赖关系的脚本链**。`desktop:build` 只是入口，真正的构建逻辑在 `packages/desktop/package.json` 的 `build:app` 脚本里——那条脚本有 300 多字符长，包含 10 多个步骤。

本课解决一个理解问题：当你面对一个 monorepo 项目的构建系统时，怎样从 `package.json` 的 scripts 出发，追踪构建的完整链路，理解每个脚本的责任和依赖关系。

## 场景：从"我想构建"到"我知道构建在做什么"

### 1.1 OriginOS 的构建系统概览

OriginOS 是一个基于 pnpm workspace 的 monorepo，构建系统涉及三个层级：

| 层级 | 文件 | 责任 | 构建目标 |
| --- | --- | --- | --- |
| **根目录** | `package.json` | 定义跨包脚本和快捷命令 | 协调各包的构建 |
| **Web 包** | `packages/web/package.json` | Next.js 应用构建 | 静态页面和 API 路由 |
| **Desktop 包** | `packages/desktop/package.json` | Electron 桌面应用构建 | 可执行文件（.exe/.dmg/.AppImage） |
| **Core 包** | `packages/core/package.json` | 共享库构建 | 类型定义和工具函数 |

根目录的 `package.json` 定义了 20 多个 scripts，但核心构建脚本只有几条：

```json
{
  "scripts": {
    "dev": "pnpm --filter @originos/web dev",
    "build": "pnpm --filter @originos/web build",
    "desktop:dev": "pnpm --filter @originos/desktop dev",
    "desktop:build": "pnpm --filter @originos/desktop build:app",
    "desktop:dist": "pnpm --filter @originos/desktop dist"
  }
}
```

**关键理解**：根目录的 scripts 只是**快捷方式**，真正的构建逻辑在各子包的 `package.json` 中。`pnpm --filter @originos/desktop` 的意思是"在 `@originos/desktop` 包中执行命令"。

### 1.2 Desktop 构建链的完整链路

Desktop 构建是最复杂的链路。打开 `packages/desktop/package.json`，`build:app` 脚本如下：

```bash
rm -rf ../web/.next ../../dist-electron && \
pnpm --filter @originos/pi-agent-adapter build && \
pnpm --filter @originos/web build && \
node scripts/prepare-web-standalone.js && \
node scripts/prepare-pi-ai-runtime-deps.js && \
pnpm build && \
node ../../scripts/check-root-build-artifacts.js && \
node scripts/verify-agent-worker-runtime.js && \
rm -rf dist-electron && \
mkdir -p dist-electron && \
cp -R ../../dist-electron/. dist-electron/ && \
node ../../scripts/check-root-build-artifacts.js
```

这条脚本链可以分解为 11 个步骤：

| 步骤 | 命令 | 作用 | 失败后果 |
| --- | --- | --- | --- |
| 1 | `rm -rf ../web/.next ../../dist-electron` | 清理旧的构建产物 | 无——只是清理 |
| 2 | `pnpm --filter @originos/pi-agent-adapter build` | 构建 Pi Agent 适配器 | Pi Agent 无法运行 |
| 3 | `pnpm --filter @originos/web build` | 构建 Next.js Web 应用 | 桌面版无法加载 Web 内容 |
| 4 | `node scripts/prepare-web-standalone.js` | 准备 Web 独立运行包 | 资源路径错误 |
| 5 | `node scripts/prepare-pi-ai-runtime-deps.js` | 准备 Pi AI 运行时依赖 | AI 功能缺失 |
| 6 | `pnpm build` | 编译 Desktop 包的 TypeScript | Electron 主进程无法运行 |
| 7 | `node ../../scripts/check-root-build-artifacts.js` | 检查根目录构建产物 | 根目录有残留文件 |
| 8 | `node scripts/verify-agent-worker-runtime.js` | 验证 Agent Worker 运行时 | Agent 协作功能异常 |
| 9 | `rm -rf dist-electron && mkdir -p dist-electron` | 清理并创建输出目录 | 无——只是清理 |
| 10 | `cp -R ../../dist-electron/. dist-electron/` | 复制构建产物 | 产物缺失 |
| 11 | `node ../../scripts/check-root-build-artifacts.js` | 再次检查根目录 | 根目录有残留文件 |

**阅读要点**：这条脚本链的设计意图是**幂等**——无论之前构建过什么，先清理再重新构建。但这也意味着每次构建都会重新构建所有依赖，即使某些依赖没有变化。

### 1.3 构建产物的输出目录

构建完成后，产物分布在以下目录：

| 产物 | 路径 | 来源 |
| --- | --- | --- |
| Next.js 静态页面 | `packages/web/.next/` | `pnpm --filter @originos/web build` |
| Electron 主进程 | `dist-electron/desktop/src/main/` | `pnpm build`（Desktop 包的 TypeScript 编译） |
| Electron 渲染进程 | `dist-electron/desktop/src/renderer/` | `pnpm build` |
| Web 独立包 | `.packaging/web-standalone/` | `prepare-web-standalone.js` |
| Pi AI 运行时依赖 | `.packaging/pi-ai-runtime/` | `prepare-pi-ai-runtime-deps.js` |
| 最终安装包 | `release/` | `electron-builder` |

**关键理解**：`dist-electron/` 是中间产物目录，`release/` 是最终产物目录。`electron-builder` 从 `dist-electron/` 读取输入，输出到 `release/`。

## 2. 脚本的责任边界

### 2.1 根目录 scripts vs 包内 scripts

根目录 `package.json` 的 scripts 设计遵循一个原则：**根目录只负责协调，包内负责实现**。

| 根目录 script | 实际执行 | 设计意图 |
| --- | --- | --- |
| `pnpm desktop:build` | `pnpm --filter @originos/desktop build:app` | 提供快捷入口 |
| `pnpm desktop:dist` | `pnpm --filter @originos/desktop dist` | 提供快捷入口 |
| `pnpm build` | `pnpm --filter @originos/web build` | 提供快捷入口 |
| `pnpm agents:check` | `node scripts/check-agents-compliance.js` | 运行合规检查 |

根目录的 scripts 本身不包含构建逻辑——它们只是转发到对应的包。真正的构建逻辑在 `packages/desktop/package.json` 和 `packages/web/package.json` 中。

### 2.2 Desktop 包的 scripts 分类

`packages/desktop/package.json` 定义了 20 多个 scripts，可以按责任分类：

**开发类**：

| script | 作用 | 使用场景 |
| --- | --- | --- |
| `dev` | 启动开发服务器（Next.js + Electron 并行） | 本地开发 |
| `build` | 编译 TypeScript | 编译主进程代码 |

**构建类**：

| script | 作用 | 依赖 |
| --- | --- | --- |
| `build:app` | 完整构建桌面应用 | Web 构建 + Pi Agent 适配器构建 + TypeScript 编译 |
| `pack` | 打包但不生成安装包 | `build:app` |
| `dist` | 打包并生成安装包 | `build:app` |

**分发类**：

| script | 作用 | 目标平台 |
| --- | --- | --- |
| `dist:win` | 构建 Windows 安装包 | Windows |
| `dist:mac` | 构建 macOS 安装包 | macOS |
| `dist:mac:arm64` | 构建 macOS ARM64 安装包 | macOS ARM64 |
| `dist:mac:x64` | 构建 macOS x64 安装包 | macOS x64 |
| `dist:linux` | 构建 Linux 安装包 | Linux |

**验证类**：

| script | 作用 | 验证内容 |
| --- | --- | --- |
| `verify:mac-package` | 验证 macOS 包 | ASAR 内容、签名、notarization |
| `verify:win-package` | 验证 Windows 包 | ASAR 内容、签名 |
| `verify:pi-task-runtime` | 验证 Pi Task Runtime | 运行时依赖 |
| `verify:release-artifacts` | 验证发布产物 | 完整性、元数据 |

### 2.3 脚本之间的依赖关系

```
dev
├── pnpm --filter @originos/pi-agent-adapter build
├── pnpm --filter @originos/web exec next dev
└── electron ...

build:app
├── pnpm --filter @originos/pi-agent-adapter build
├── pnpm --filter @originos/web build
├── prepare-web-standalone.js
├── prepare-pi-ai-runtime-deps.js
├── pnpm build (TypeScript)
└── verify-agent-worker-runtime.js

dist
├── build:app
└── electron-builder

dist:mac
├── build:app
└── electron-builder --mac
```

**阅读要点**：`dist` 依赖 `build:app`，`build:app` 依赖 Web 构建和 Pi Agent 适配器构建。这意味着如果你只改了 Desktop 包的代码，运行 `dist` 时也会重新构建 Web 包——即使 Web 包没有变化。

## 3. `electron-builder.yml` 配置精读

### 3.1 配置文件的定位

`electron-builder.yml` 位于 `packages/desktop/` 目录下，是 Electron 桌面应用的构建配置。它的作用是告诉 `electron-builder`：**输入是什么、输出在哪里、目标平台是什么、如何签名和分发**。

### 3.2 核心配置项

```yaml
appId: com.originos.ce              # 应用的唯一标识
productName: OriginOS CE            # 应用显示名称
artifactName: ${productName}-${version}-${arch}.${ext}  # 产物命名格式

directories:
  output: ../../release              # 最终产物输出目录
  buildResources: ../../resources    # 构建资源目录

electronVersion: 42.3.3              # Electron 版本
```

**关键理解**：`directories.output` 指向 `../../release`，这意味着构建产物最终会输出到仓库根目录的 `release/` 文件夹下——而不是 `packages/desktop/` 下。

### 3.3 文件打包规则

```yaml
files:
  - dist-electron/**/*                 # 打包编译后的主进程代码
  - from: dist-electron/core/src/lib   # 从 core 包复制特定文件
    to: dist-electron/core/src/lib
    filter:
      - "**/*.js"                     # 只复制 .js 文件
  - package.json                       # 必须包含 package.json
  - "!**/*.map"                        # 排除 source map
```

`files` 字段定义了哪些文件会被打包进 ASAR（Electron 的归档格式）。它的规则是：

| 规则 | 含义 | 示例 |
| --- | --- | --- |
| `dist-electron/**/*` | 包含整个目录 | 主进程代码 |
| `from: ... to: ...` | 从源路径复制到目标路径 | core 包的编译产物 |
| `"!**/*.map"` | 排除匹配的文件 | source map |

**阅读风险**：`files` 字段的配置决定了哪些代码会被打包进最终的应用。如果某个文件没有被包含在 `files` 中，运行时就会报 `MODULE_NOT_FOUND` 错误。如果某个文件被错误地包含，会增加包体积。

### 3.4 平台特定配置

```yaml
mac:
  icon: ../../resources/icons/icon.icns
  category: public.app-category.developer-tools
  forceCodeSigning: true              # 强制代码签名
  hardenedRuntime: true               # 启用 hardened runtime
  notarize: false                     # 不自动 notarize（用 afterSign 脚本处理）

win:
  icon: ../../resources/icons/icon.png
  target:
    - target: nsis                    # Windows 安装程序
      arch: [x64]
    - target: zip                     # ZIP 压缩包
      arch: [x64]

linux:
  icon: ../../resources/icons/icon.png
  target:
    - target: AppImage                # Linux AppImage
      arch: [x64]
```

**关键理解**：macOS 构建需要代码签名和 notarization，Windows 构建需要 NSIS 安装程序，Linux 构建生成 AppImage。这些平台特定的配置决定了最终产物的格式和分发方式。

## 4. 构建验证脚本

### 4.1 为什么需要验证脚本

构建完成后，需要验证产物是否正确。OriginOS 的验证脚本位于 `packages/desktop/scripts/` 目录下：

| 脚本 | 验证内容 | 在 CI 中的位置 |
| --- | --- | --- |
| `verify-mac-package.js` | macOS 包的 ASAR 内容、签名、notarization | `desktop-release.yml` macOS job |
| `verify-windows-package.js` | Windows 包的 ASAR 内容 | `desktop-release.yml` Windows job |
| `verify-pi-task-runtime-package.js` | Pi Task Runtime 依赖 | 所有平台 job |
| `verify-release-artifacts.js` | 发布产物完整性 | Publish job |
| `verify-update-metadata.js` | 更新元数据 | Publish job |
| `verify-agent-worker-runtime.js` | Agent Worker 运行时 | `build:app` 中 |

### 4.2 验证脚本的阅读方法

以 `verify-mac-package.js` 为例：

```javascript
// 1. 找到构建产物
const candidateAppPaths = [
  path.join(releaseDir, 'mac-arm64', productName),
  path.join(releaseDir, 'mac', productName),
];

// 2. 验证 ASAR 内容
const asarPath = path.join(resourcesDir, 'app.asar');
const asarContents = await asar.listPackage(asarPath);

// 3. 检查关键文件是否存在
const requiredFiles = [
  'package.json',
  'dist-electron/desktop/src/main/main.js',
  // ...
];

// 4. 验证签名和 notarization
// ...
```

**阅读要点**：验证脚本的核心逻辑是"**构建产物应该包含什么、不应该包含什么**"。阅读验证脚本时，重点看 `requiredFiles` 数组和排除规则——它们定义了"正确的构建产物"的标准。

## 5. 构建脚本的四种阅读模式

### 5.1 追踪构建链

**问题**：运行 `pnpm desktop:build` 时发生了什么？

**方法**：
1. 打开根目录 `package.json`，找到 `desktop:build` → `pnpm --filter @originos/desktop build:app`
2. 打开 `packages/desktop/package.json`，找到 `build:app`
3. 按顺序阅读 `build:app` 中的每个命令
4. 追踪每个命令的输入和输出

### 5.2 理解产物来源

**问题**：`release/OriginOS CE-0.1.47-x64.exe` 是怎么生成的？

**方法**：
1. 产物由 `electron-builder` 生成
2. `electron-builder` 的配置在 `electron-builder.yml` 中
3. `electron-builder` 的输入是 `dist-electron/` 目录
4. `dist-electron/` 由 `build:app` 脚本生成
5. 追踪 `build:app` 的每个步骤，找到影响产物的命令

### 5.3 排查构建失败

**问题**：`pnpm desktop:build` 报错了，怎么定位问题？

**方法**：
1. 查看报错信息，确定是哪个步骤失败
2. 在 `build:app` 脚本中找到对应的命令
3. 单独运行该命令，查看详细错误
4. 检查该命令的输入是否存在
5. 检查该命令的依赖是否已构建

### 5.4 理解 CI 构建流程

**问题**：GitHub Actions 是怎么构建桌面应用的？

**方法**：
1. 打开 `.github/workflows/desktop-release.yml`
2. 找到对应平台的 job（windows/macos-arm64/macos-x64）
3. 按顺序阅读每个 step
4. 对比 CI 步骤和本地 `build:app` 脚本的差异

## 6. 文档覆盖台账

| 本课直接精读的文档 | 精读范围 | 配对验证 | 本课只证明什么 |
| --- | --- | --- | --- |
| 根目录 `package.json` scripts | 全部 scripts | 对照各包 package.json 验证转发关系 | 根目录 scripts 只是快捷方式 |
| `packages/desktop/package.json` scripts | `build:app`、`dist`、`dev` 等核心 scripts | 对照实际构建命令验证 | Desktop 包的构建链 |
| `packages/desktop/electron-builder.yml` | 完整配置 | 对照构建产物验证 | Electron 构建配置 |
| `packages/desktop/scripts/verify-mac-package.js` | 前 40 行 | 对照 macOS 构建产物验证 | 验证脚本的核心逻辑 |
| `.github/workflows/desktop-release.yml` | 前 100 行（Windows + macOS jobs） | 对照本地构建流程验证 | CI 构建流程 |

本课没有精读的内容也要明说：

- `packages/web/package.json` 的 Next.js 构建脚本只做了概述，未逐行精读
- `packages/core/package.json` 的 exports 字段只做了概述
- `packages/desktop/scripts/` 中其他验证脚本（verify-windows-package.js、verify-release-artifacts.js 等）只做了目录级确认
- 本地 Windows 构建脚本 `build-windows-local.js` 只读了前 40 行
- pnpm workspace 配置（`pnpm-workspace.yaml`）未精读

## 7. 练习：构建链路追踪

### 任务 A：追踪 `pnpm desktop:dist` 的完整链路

已知信息：`pnpm desktop:dist` → `pnpm --filter @originos/desktop dist`。

请按顺序列出 `dist` 脚本执行的所有步骤，以及每个步骤的输入和输出。

### 任务 B：判断构建产物是否包含某个文件

已知信息：你想确认 `packages/core/src/lib/paths.js` 是否被打包进最终的桌面应用。

请说明你应该查看哪个配置文件、哪个字段，以及如何验证。

### 任务 C：排查构建失败

已知信息：运行 `pnpm desktop:build` 时，在 `node scripts/verify-agent-worker-runtime.js` 步骤报错。

请说明你的排查思路。

### 参考答案

**任务 A：**

| 步骤 | 命令 | 输入 | 输出 |
| --- | --- | --- | --- |
| 1 | `build:app` | 源代码 | `dist-electron/`、`dist/` |
| 2 | `electron-builder --config electron-builder.yml --publish never` | `dist-electron/`、`electron-builder.yml` | `release/` 目录下的安装包 |

`dist` 脚本 = `build:app` + `electron-builder`。`build:app` 生成中间产物，`electron-builder` 将中间产物打包成安装包。

**任务 B：**

应该查看 `packages/desktop/electron-builder.yml` 的 `files` 字段。如果 `packages/core/src/lib/paths.js` 的编译产物（`dist-electron/core/src/lib/paths.js`）被包含在 `files` 中，则会被打包。验证方法是构建后检查 ASAR 内容，或查看 `verify-mac-package.js` 中的检查逻辑。

**任务 C：**

排查思路：
1. 单独运行 `node packages/desktop/scripts/verify-agent-worker-runtime.js`，查看详细错误
2. 检查该脚本验证的内容（Agent Worker 运行时文件是否存在）
3. 检查上一步 `pnpm build` 是否成功编译了 Agent Worker 相关代码
4. 检查 `dist-electron/` 目录下是否存在 Agent Worker 的编译产物
5. 如果缺失，检查 `packages/core/src/modules/collaboration-runtime/sandbox/` 目录的代码是否编译成功

## 8. 口头验收

学完本课后，不看正文也应能回答下面五个问题：

1. 根目录 `package.json` 的 scripts 和 `packages/desktop/package.json` 的 scripts 分别承担什么责任？为什么需要分层？
2. `packages/desktop/package.json` 的 `build:app` 脚本包含哪些步骤？其中哪一步最容易失败？
3. `electron-builder.yml` 的 `files` 字段决定了什么？如果某个文件没有被包含在 `files` 中，会有什么后果？
4. 验证脚本（如 `verify-mac-package.js`）的核心逻辑是什么？它们和构建脚本的关系是什么？
5. 当你需要排查 `pnpm desktop:build` 的构建失败时，应该按什么步骤排查？

合格回答不要求背诵每个脚本的具体命令，但必须能说清构建链的分层结构、脚本之间的依赖关系、以及排查构建失败的基本方法。能说清"构建在做什么"比只说清"运行了哪个命令"更重要。
