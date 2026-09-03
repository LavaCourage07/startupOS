# M19 资源目录结构如何阅读——从 `resources/` 到应用图标

小林想知道 OriginOS 的资源文件都存储在哪里。她打开 `resources/` 目录，看到 `icons/` 子目录和几个 `.plist` 文件。她以为资源很简单——就一些图标。

但她不知道的是：**资源文件不仅影响应用的外观，还影响应用的签名、分发和平台兼容性**。更关键的是，资源文件的组织和命名规则直接决定了 Electron Builder 能否正确打包应用。

本课解决一个理解问题：当你面对 OriginOS 的资源目录时，怎样理解每个文件的作用、它们之间的关系、以及资源文件在构建和分发中的角色。

## 场景：从"一些图标"到"资源文件的完整地图"

### 1.1 `resources/` 目录的顶层结构

OriginOS 的资源目录位于 `resources/`：

```
resources/
├── entitlements.mac.inherit.plist   # macOS 继承权限配置
├── entitlements.mac.plist           # macOS 权限配置
└── icons/                           # 应用图标
    ├── README.md
    ├── icon.icns                    # macOS 图标
    ├── icon.png                     # 通用图标
    ├── tray-icon.png                # 托盘图标
    └── tray-iconTemplate.png        # 托盘图标模板
```

### 1.2 每种资源文件的作用

| 文件 | 作用 | 平台 | 构建阶段 |
| --- | --- | --- | --- |
| `icon.icns` | macOS 应用图标 | macOS | 打包时嵌入 `.app` |
| `icon.png` | 通用图标（Windows/Linux） | Windows/Linux | 打包时嵌入安装包 |
| `tray-icon.png` | 系统托盘图标 | 所有平台 | 运行时加载 |
| `tray-iconTemplate.png` | macOS 托盘图标模板 | macOS | 运行时加载 |
| `entitlements.mac.plist` | macOS 应用权限声明 | macOS | 打包时嵌入签名 |
| `entitlements.mac.inherit.plist` | macOS 继承权限声明 | macOS | 打包时嵌入签名 |

## 2. 图标资源精读

### 2.1 图标格式对比

| 格式 | 用途 | 尺寸要求 | 透明度支持 |
| --- | --- | --- | --- |
| `.icns` | macOS 应用图标 | 多种尺寸（16x16 到 1024x1024） | 是 |
| `.png` | 通用图标 | 推荐 512x512 或更大 | 是 |
| `.ico` | Windows 图标 | 多种尺寸 | 是 |

**关键理解**：macOS 使用 `.icns` 格式，因为它可以包含多种尺寸的图标，系统会根据显示场景自动选择合适的尺寸。Windows 使用 `.ico` 格式，Linux 使用 `.png` 格式。

### 2.2 图标在构建中的角色

`electron-builder.yml` 中的图标配置：

```yaml
mac:
  icon: ../../resources/icons/icon.icns

win:
  icon: ../../resources/icons/icon.png

linux:
  icon: ../../resources/icons/icon.png
```

**关键理解**：图标路径是相对于 `packages/desktop/electron-builder.yml` 的。`../../resources/icons/` 指向的是仓库根目录的 `resources/icons/` 目录。

## 3. 权限配置精读

### 3.1 `entitlements.mac.plist` 的作用

`entitlements.mac.plist` 是 macOS 应用的权限声明文件：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
</dict>
</plist>
```

**关键字段**：

| 字段 | 含义 | 作用 |
| --- | --- | --- |
| `com.apple.security.cs.allow-jit` | 允许 JIT 编译 | Electron 需要 JIT 编译 JavaScript |
| `com.apple.security.cs.allow-unsigned-executable-memory` | 允许未签名的可执行内存 | Electron 需要动态生成代码 |

**关键理解**：macOS 的 Hardened Runtime 默认禁止 JIT 编译和动态代码生成。Electron 应用需要这些权限，因此必须在 `entitlements.mac.plist` 中声明。

### 3.2 权限配置与签名的关系

```mermaid
flowchart LR
    A[entitlements.mac.plist] --> B[代码签名]
    B --> C[Notarization]
    C --> D[应用分发]
```

**关键理解**：权限配置是代码签名的一部分。如果 `entitlements.mac.plist` 缺失或配置错误，应用可能无法通过 Notarization，或者在运行时因为权限不足而崩溃。

## 4. 资源目录的阅读方法

### 4.1 三步阅读法

**第一步：看文件类型**

资源目录下有哪些类型的文件？图标、权限配置、还是其他？

**第二步：看平台关联**

每个文件对应哪个平台？macOS、Windows 还是 Linux？

**第三步：看构建关联**

每个文件在构建和分发中的角色是什么？

### 4.2 资源文件与构建产物的关系

| 资源文件 | 构建产物 | 嵌入方式 |
| --- | --- | --- |
| `icon.icns` | `.app/Contents/Resources/icon.icns` | 打包时复制 |
| `icon.png` | `.exe` 或 `.AppImage` 的图标 | 打包时嵌入 |
| `entitlements.mac.plist` | 签名信息 | 打包时嵌入签名 |

## 5. 文档覆盖台账

| 本课直接精读的内容 | 精读范围 | 配对验证 | 本课只证明什么 |
| --- | --- | --- | --- |
| `resources/` 目录结构 | 目录列表 | 对照 `electron-builder.yml` 验证 | 资源文件的种类和作用 |
| `resources/icons/icon.icns` | 目录确认 | — | macOS 图标的存在 |
| `resources/entitlements.mac.plist` | 示例内容 | 对照 Apple 文档验证 | 权限配置的结构 |

本课没有精读的内容也要明说：

- `.icns` 文件的内部结构未精读
- Windows `.ico` 文件未涉及（项目中没有）
- 其他平台特定的资源文件未涉及

## 6. 练习：资源文件阅读

### 任务 A：判断图标格式

已知信息：需要为 OriginOS 添加一个新的平台图标。

问题：应该使用什么格式？存储在哪里？

### 任务 B：理解权限配置

已知信息：应用需要在 macOS 上访问摄像头。

问题：应该在 `entitlements.mac.plist` 中添加什么配置？

### 参考答案

**任务 A：**

| 平台 | 格式 | 路径 |
| --- | --- | --- |
| macOS | `.icns` | `resources/icons/icon.icns` |
| Windows | `.ico` | `resources/icons/icon.ico` |
| Linux | `.png` | `resources/icons/icon.png` |

**任务 B：**

```xml
<key>com.apple.security.device.camera</key>
<true/>
```

## 7. 口头验收

学完本课后，不看正文也应能回答下面五个问题：

1. `resources/` 目录下有哪些类型的文件？每种文件的作用是什么？
2. 图标资源有哪些格式？各适用于什么平台？
3. `entitlements.mac.plist` 的作用是什么？为什么需要它？
4. 资源文件在构建和分发中的角色是什么？
5. 当你需要添加新的平台图标时，应该怎么做？

合格回答不要求背诵每个文件的具体内容，但必须能说清资源文件的种类、作用、以及平台关联。能说清"资源文件在构建中的角色"比只说清"资源文件在哪里"更重要。
