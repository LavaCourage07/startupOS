# M21 资源依赖关系如何阅读——从 `resources/` 到构建产物

小林想知道 OriginOS 的资源文件是如何被构建系统使用的。她看到 `resources/` 目录下的文件在 `electron-builder.yml` 中被引用，但不知道它们之间的依赖关系。

本课解决一个理解问题：当你面对 OriginOS 的资源文件时，怎样理解它们与构建系统、应用运行时之间的依赖关系。

## 场景：从"资源文件"到"依赖关系图"

### 1.1 资源文件的依赖关系概览

```mermaid
flowchart LR
    A[resources/] --> B[electron-builder.yml]
    B --> C[构建产物]
    C --> D[应用运行时]
```

| 依赖关系 | 描述 | 示例 |
| --- | --- | --- |
| 资源 → 构建配置 | 资源文件在构建配置中被引用 | `icon: ../../resources/icons/icon.icns` |
| 构建配置 → 构建产物 | 构建配置决定产物的内容 | `.app` 包含 `icon.icns` |
| 构建产物 → 应用运行时 | 应用运行时读取构建产物中的资源 | 显示应用图标 |

### 1.2 资源文件与构建配置的依赖

`electron-builder.yml` 中的资源引用：

```yaml
mac:
  icon: ../../resources/icons/icon.icns
  entitlements: ../../resources/entitlements.mac.plist

win:
  icon: ../../resources/icons/icon.png

linux:
  icon: ../../resources/icons/icon.png
```

**关键理解**：资源文件的路径是相对于 `packages/desktop/electron-builder.yml` 的。`../../resources/` 指向仓库根目录的 `resources/`。

## 2. 资源文件与构建产物的依赖

### 2.1 资源文件如何嵌入构建产物

| 资源文件 | 构建产物 | 嵌入位置 |
| --- | --- | --- |
| `icon.icns` | `.app` | `Contents/Resources/icon.icns` |
| `icon.png` | `.exe` | 安装包的图标资源 |
| `entitlements.mac.plist` | `.app` | 签名信息中 |
| `tray-icon.png` | `.app`、`.exe` | 运行时加载 |

### 2.2 资源文件与 ASAR 的关系

Electron 的 ASAR 归档格式用于打包应用代码和资源。但某些资源文件（如 `icon.icns`）是**在构建时嵌入**，而不是在运行时从 ASAR 加载。

**关键理解**：

- **构建时嵌入**：`icon.icns` 在打包时嵌入 `.app` 的 `Contents/Resources/` 目录
- **运行时加载**：`tray-icon.png` 在运行时从 ASAR 或文件系统加载

## 3. 资源文件与应用运行时的依赖

### 3.1 运行时加载的资源

| 资源文件 | 加载时机 | 加载方式 |
| --- | --- | --- |
| `tray-icon.png` | 应用启动时 | `nativeImage.createFromPath()` |
| `tray-iconTemplate.png` | 应用启动时 | `nativeImage.createFromPath()` |

### 3.2 运行时加载的代码示例

```javascript
const { nativeImage } = require('electron');
const path = require('path');

// 加载托盘图标
const trayIcon = nativeImage.createFromPath(
  path.join(__dirname, 'resources/tray-icon.png')
);
```

**关键理解**：运行时加载的资源需要确保在打包后仍然可以被找到。通常这些资源会被放在 `dist-electron/` 目录下，然后被 ASAR 打包。

## 4. 文档覆盖台账

| 本课直接精读的内容 | 精读范围 | 配对验证 | 本课只证明什么 |
| --- | --- | --- | --- |
| `electron-builder.yml` 资源引用 | 示例内容 | 对照构建产物验证 | 资源文件与构建配置的依赖 |
| 资源嵌入位置 | 概念描述 | — | 资源文件在构建产物中的位置 |
| 运行时加载 | 代码示例 | — | 资源文件在运行时的加载方式 |

本课没有精读的内容也要明说：

- ASAR 归档的内部结构未精读
- `nativeImage` 的完整 API 未精读
- 其他运行时资源加载方式未涉及

## 5. 练习：依赖关系分析

### 任务 A：分析资源依赖

已知信息：`icon.icns` 在 `electron-builder.yml` 中被引用。

问题：它最终出现在构建产物的什么位置？

### 任务 B：理解运行时加载

已知信息：`tray-icon.png` 在应用启动时被加载。

问题：它从哪里加载？需要确保什么？

### 参考答案

**任务 A：**

| 构建产物 | 位置 |
| --- | --- |
| `.app` | `Contents/Resources/icon.icns` |

**任务 B：**

| 问题 | 答案 |
| --- | --- |
| 加载来源 | `dist-electron/` 目录下的 `resources/tray-icon.png` |
| 需要确保 | 文件在打包后仍然存在于正确的路径 |

## 6. 口头验收

学完本课后，不看正文也应能回答下面五个问题：

1. 资源文件与构建配置之间的依赖关系是什么？
2. 资源文件如何嵌入构建产物？各出现在什么位置？
3. 运行时加载的资源与构建时嵌入的资源有什么区别？
4. 当你需要添加新的资源文件时，应该确保什么？
5. 资源文件的依赖关系对构建和分发有什么影响？

合格回答不要求背诵每个文件的具体路径，但必须能说清资源文件的依赖关系、嵌入方式、以及加载机制。能说清"资源文件如何被使用"比只说清"资源文件在哪里"更重要。
