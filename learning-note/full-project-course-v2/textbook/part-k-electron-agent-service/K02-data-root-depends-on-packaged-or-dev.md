# K02 · 桌面版的数据根目录是怎样确定的

> **课号** K02 · **轨道** T13 · **文件** `setup-data-root.ts` · `paths.ts` · **预计阅读** 20 分钟

---

## 本课要回答的问题

K01 提到 `setup-data-root` 必须是第一个 import，它覆写了 Core 的路径解析。但具体覆写了什么？打包态和开发态的数据目录为什么不同？Core 的 `getDataRoot()` 怎样被 Electron 注入？`paths.ts` 又提供了哪些桌面端专用的路径工具？

## 概念阶梯

### 第一层：为什么桌面版需要自己的路径解析

Core 包（`packages/core/src/lib/paths.ts`）有自己的路径解析逻辑：

- **Web 版**：`getDataRoot()` 返回 monorepo 根目录的 `data/`。
- **桌面版打包态**：应该返回 `~/Library/Application Support/OriginOS CE/data/`（macOS）。

问题在于 Core 是共享包，它不知道自己在 Web 版还是桌面版中运行。桌面版需要在启动时告诉 Core："你现在在 Electron 中，数据目录在这里。"

### 第二层：注入机制

Core 的 `paths.ts` 暴露了两个 setter：

```typescript
// packages/core/src/lib/paths.ts（简化）
let _electronDataRoot: string | undefined;
let _monorepoRoot: string | undefined;

export function setElectronDataRoot(value: string): void {
  _electronDataRoot = value;
}

export function setMonorepoRoot(value: string): void {
  _monorepoRoot = value;
}

export function getDataRoot(): string {
  if (_electronDataRoot) return _electronDataRoot;
  // ... 回退逻辑
}
```

`setup-data-root.ts` 在导入时调用这两个 setter，把桌面版的路径注入 Core。之后 Core 中任何代码调用 `getDataRoot()` 都会拿到 Electron 注入的路径。

### 第三层：打包态 vs 开发态

| 状态 | `app.isPackaged` | `getDataRoot()` 返回 | `getMonorepoRoot()` 返回 |
| --- | --- | --- | --- |
| 开发态 | `false` | monorepo 根目录的 `data/` | monorepo 根目录 |
| 打包态 | `true` | `userData/data` | `process.resourcesPath` |

开发态不设置 `_electronDataRoot`，让 Core 回退到 monorepo 的 `data/`。这样开发时所有数据都在项目目录里，方便调试。

打包态设置 `_electronDataRoot` 为 `userData/data`，`_monorepoRoot` 为 `process.resourcesPath`（应用包内的资源目录）。

## 源码窗口

### 窗口 1：setup-data-root.ts 全文（22 行）

```typescript
import { app } from 'electron';
import path from 'path';
import { setElectronDataRoot, setMonorepoRoot } from '../../../core/src/lib/paths';

if (app.isPackaged) {
  const dataRoot = path.join(app.getPath('userData'), 'data');
  setElectronDataRoot(dataRoot);
  setMonorepoRoot(process.resourcesPath);
  console.log('[setup-data-root] Packaged mode → DATA_ROOT:', dataRoot,
    'MONOREPO_ROOT:', process.resourcesPath);
} else {
  console.log('[setup-data-root] Dev mode → using monorepo defaults');
}
```

**逐行解读：**

- **第 9 行**：从相对路径导入 Core 的 `paths.ts`。注意是 `../../../core/src/lib/paths`——这是一个跨包的源码级导入，不是通过 npm 包名。这是因为 Electron 主进程使用 CJS 编译，需要在编译时直接引用 Core 源码。
- **第 11 行** `app.isPackaged`：Electron 的 API，打包态返回 `true`，开发态返回 `false`。判断依据是应用是否在 `app.asar` 归档中运行。
- **第 13 行**：`app.getPath('userData')` 返回平台特定的用户数据目录。macOS 上是 `~/Library/Application Support/OriginOS CE/`。
- **第 14–15 行**：注入两个路径。之后 Core 的 `getDataRoot()` 返回 `userData/data`，`getMonorepoRoot()` 返回 `process.resourcesPath`。
- **第 17–20 行**：开发态什么都不设置。Core 的 `getDataRoot()` 会回退到 `getMonorepoRoot()/data`，即 monorepo 根目录的 `data/`。

### 窗口 2：paths.ts 的 getMonorepoRoot()（第 17–40 行）

```typescript
let _cachedRoot: string | null = null;

export function getMonorepoRoot(): string {
  if (_cachedRoot) return _cachedRoot;

  if (process.env['MONOREPO_ROOT']) {
    _cachedRoot = process.env['MONOREPO_ROOT'];
    return _cachedRoot;
  }

  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      _cachedRoot = dir;
      return _cachedRoot;
    }
    dir = path.dirname(dir);
  }

  _cachedRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
  return _cachedRoot;
}
```

**三级回退策略：**

1. **缓存命中**：`_cachedRoot` 不为 `null` 时直接返回。路径解析只执行一次。
2. **环境变量**：`MONOREPO_ROOT` 环境变量存在时使用它。这允许在 CI 或特殊部署场景中覆盖。
3. **向上查找**：从 `__dirname`（编译后是 `dist-electron/desktop/src/main/`）向上最多 8 层，寻找 `pnpm-workspace.yaml`。找到即认为是 monorepo 根目录。
4. **硬编码回退**：如果找不到，假设 `__dirname` 向上 6 层就是根目录。这是一个兜底，防止路径解析完全失败。

### 窗口 3：paths.ts 的 getDataRoot() 和子目录工具（第 45–88 行）

```typescript
export function getDataRoot(): string {
  if (process.env['DATA_ROOT']) {
    return process.env['DATA_ROOT'];
  }
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'data');
  }
  return path.join(getMonorepoRoot(), 'data');
}

export function getProjectDataDir(projectId: string): string {
  return path.join(getDataRoot(), 'projects', projectId);
}

export function getAgentsDataDir(): string {
  return path.join(getDataRoot(), 'agents');
}

export function getSkillsDataDir(): string {
  return path.join(getDataRoot(), 'skills');
}

export function getTemplatesDir(): string {
  return path.join(getMonorepoRoot(), 'templates', 'project-interview');
}

export function getClaudeDir(): string {
  return path.join(getMonorepoRoot(), '.claude');
}
```

**注意 `getDataRoot()` 的三级回退：**

1. `DATA_ROOT` 环境变量（最高优先级）
2. 打包态：`userData/data`
3. 开发态：`monorepoRoot/data`

**子目录工具的分野：**

- `getProjectDataDir`、`getAgentsDataDir`、`getSkillsDataDir`：基于 `getDataRoot()`，数据目录。
- `getTemplatesDir`、`getClaudeDir`：基于 `getMonorepoRoot()`，资源目录。模板和 `.claude` 是只读的源代码资源，不是运行时数据。

## 失败路径

### 失败 1：setup-data-root 导入顺序错误

如果 `setup-data-root` 不是第一个 import，Core 的 `paths.ts` 会先被其他模块加载。此时 `_electronDataRoot` 还没被设置，`getDataRoot()` 会返回 monorepo 根目录的 `data/`。打包态下这个路径不存在，导致运行时错误。

### 失败 2：pnpm-workspace.yaml 找不到

`getMonorepoRoot()` 的向上查找最多 8 层。如果编译产物的目录层级超过 8 层，查找会失败，回退到硬编码的 6 层。如果 6 层也不对，路径解析会指向一个不存在的目录。

### 失败 3：环境变量冲突

如果用户同时设置了 `DATA_ROOT` 和 `MONOREPO_ROOT`，`getDataRoot()` 优先使用 `DATA_ROOT`，`getMonorepoRoot()` 优先使用 `MONOREPO_ROOT`。这可能导致数据目录和资源目录不在同一个 monorepo 中。

## 测试证据

路径解析的正确性通过以下方式验证：

- **开发态**：启动 `pnpm dev`，在 renderer 中调用 `getDataRoot()`，确认返回 monorepo 的 `data/`。
- **打包态**：构建 `.dmg`（macOS），安装后启动，检查 `~/Library/Application Support/OriginOS CE/data/` 是否被创建。
- **环境变量覆盖**：设置 `DATA_ROOT=/tmp/test-data`，启动应用，确认数据写入 `/tmp/test-data/`。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么 Core 的 `getDataRoot()` 需要被 Electron 覆写？Core 自己不能判断运行环境吗？

2. `paths.ts` 的 `getMonorepoRoot()` 为什么要向上查找 `pnpm-workspace.yaml`？为什么不直接用 `__dirname` 的固定偏移？

3. `getTemplatesDir()` 和 `getProjectDataDir()` 基于不同的根目录。为什么？

<details>
<summary>参考答案</summary>

1. Core 是共享包，Web 版和桌面版都使用它。Web 版的数据在 monorepo 的 `data/`，桌面版打包态的数据在 `userData/data`。Core 无法判断自己是否在 Electron 中运行（它不依赖 Electron），所以需要 Electron 主动注入。

2. `__dirname` 在编译后的位置取决于构建配置。向上查找 `pnpm-workspace.yaml` 是一种自适应策略，即使目录层级变化也能找到根目录。固定偏移太脆弱。

3. `getTemplatesDir()` 返回源代码中的模板目录（只读资源），基于 `getMonorepoRoot()`。`getProjectDataDir()` 返回运行时数据目录（可写），基于 `getDataRoot()`。打包态下模板在 `process.resourcesPath/templates/`，数据在 `userData/data/projects/`。

</details>

### 练习 2（源码阅读）

阅读 `paths.ts` 的 `getMonorepoRoot()` 函数，回答：

1. 如果 `MONOREPO_ROOT` 环境变量和 `pnpm-workspace.yaml` 都存在，哪个优先？
2. 为什么 `_cachedRoot` 用 `null` 而不是 `undefined` 作为初始值？
3. 向上查找的循环最多 8 次，硬编码回退是 6 层。为什么数字不同？

<details>
<summary>参考答案</summary>

1. 环境变量优先。`process.env['MONOREPO_ROOT']` 的检查在 `pnpm-workspace.yaml` 查找之前。

2. `null` 表示"还没计算过"，`undefined` 在 JavaScript 中通常表示"不存在"。用 `null` 作为哨兵值更清晰。而且 `if (_cachedRoot)` 对 `null` 和空字符串都返回 `false`，可以防止空字符串被当作有效路径。

3. 8 次是最大查找深度（防御性上限），6 层是当前编译产物目录层级的经验值。如果编译配置变化导致层级变化，6 层回退可能不对，但 8 次查找仍能覆盖。

</details>

## 口头验收

完成本课后，你应该能用 45 秒口头描述：

> "桌面版有两套路径：数据目录和资源目录。`setup-data-root.ts` 在导入时调用 Core 的 `setElectronDataRoot()` 和 `setMonorepoRoot()`，把打包态的路径注入 Core。打包态数据在 `userData/data`，资源在 `process.resourcesPath`。开发态不注入，Core 回退到 monorepo 的 `data/`。`paths.ts` 的 `getMonorepoRoot()` 用三级回退：缓存 → 环境变量 → 向上查找 `pnpm-workspace.yaml` → 硬编码偏移。子目录工具分两类：数据目录基于 `getDataRoot()`，资源目录基于 `getMonorepoRoot()`。"

## 下一课预告

K02 解释了数据目录的解析逻辑。K03 会进入 `window-manager.ts`，看主窗口和 Dock 窗口怎样被创建、复用和销毁。
