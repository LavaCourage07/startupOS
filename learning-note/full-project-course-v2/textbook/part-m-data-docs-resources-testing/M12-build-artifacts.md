# M12 构建产物如何阅读——从 `release/` 目录到可安装包

小林运行完 `pnpm desktop:dist` 后，打开 `release/` 目录，看到一堆文件：`.exe`、`.dmg`、`.zip`、`.blockmap`、`latest.yml`、SHA256SUMS 等。她不知道这些文件分别是什么、哪个是给用户的、哪个是给自动更新用的、哪个是校验文件。

本课解决一个理解问题：当你面对构建产物目录时，怎样理解每个文件的作用、它们之间的关系、以及如何判断产物是否完整。

## 场景：从"一堆文件"到"每个文件都有明确用途"

### 1.1 `release/` 目录的结构

运行 `pnpm desktop:dist` 后，`release/` 目录下的文件：

```
release/
├── OriginOS CE-0.1.47-x64.exe          # Windows 安装程序
├── OriginOS CE-0.1.47-x64.exe.blockmap  # 差量更新映射
├── OriginOS CE-0.1.47-x64.zip           # Windows ZIP 包
├── OriginOS CE-0.1.47-arm64.dmg         # macOS ARM64 磁盘镜像
├── OriginOS CE-0.1.47-arm64.dmg.blockmap
├── OriginOS CE-0.1.47-arm64.zip
├── OriginOS CE-0.1.47-x64.dmg           # macOS x64 磁盘镜像
├── OriginOS CE-0.1.47-x64.dmg.blockmap
├── OriginOS CE-0.1.47-x64.zip
├── latest.yml                           # 自动更新元数据
├── latest-mac.yml                       # macOS 自动更新元数据
└── SHA256SUMS                           # 校验和文件
```

### 1.2 每种文件的作用

| 文件 | 作用 | 给谁用 |
| --- | --- | --- |
| `.exe` | Windows 安装程序 | 用户下载安装 |
| `.dmg` | macOS 磁盘镜像 | 用户下载安装 |
| `.zip` | 压缩包（无需安装） | 用户下载解压即用 |
| `.blockmap` | 差量更新映射 | 自动更新系统（Electron） |
| `latest.yml` | 自动更新元数据 | 自动更新系统 |
| `SHA256SUMS` | 文件校验和 | 用户验证文件完整性 |

## 2. 产物文件的详细说明

### 2.1 安装包（`.exe`、`.dmg`）

安装包是用户直接下载和安装的文件：

| 平台 | 格式 | 安装方式 | 特点 |
| --- | --- | --- | --- |
| Windows | `.exe` | 双击运行，按向导安装 | 支持自定义安装路径 |
| macOS | `.dmg` | 双击挂载，拖拽到 Applications | 支持 Gatekeeper 安全检查 |

**关键理解**：`.exe` 和 `.dmg` 是最终用户看到的文件。它们包含了应用的所有代码和资源，以及安装程序。

### 2.2 差量更新映射（`.blockmap`）

`.blockmap` 文件用于支持差量更新：

```
OriginOS CE-0.1.47-x64.exe.blockmap
```

**作用**：当用户从 0.1.46 更新到 0.1.47 时，自动更新系统不需要下载完整的 `.exe` 文件，只需要下载差异部分。`.blockmap` 文件定义了文件的块结构，让更新系统知道哪些块需要更新。

**关键理解**：`.blockmap` 对用户不可见，但对自动更新机制至关重要。如果 `.blockmap` 缺失，自动更新会回退到完整下载——更新速度会变慢，但功能仍然可用。

### 2.3 自动更新元数据（`latest.yml`）

`latest.yml` 是 Electron 自动更新机制的核心文件：

```yaml
version: 0.1.47
files:
  - url: OriginOS CE-0.1.47-x64.exe
    sha512: abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
    size: 12345678
  - url: OriginOS CE-0.1.47-arm64.dmg
    sha512: fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321
    size: 23456789
```

**关键字段**：

| 字段 | 作用 | 示例 |
| --- | --- | --- |
| `version` | 当前最新版本号 | `0.1.47` |
| `files[].url` | 产物文件名 | `OriginOS CE-0.1.47-x64.exe` |
| `files[].sha512` | 文件的 SHA512 校验和 | 64 位十六进制字符串 |
| `files[].size` | 文件大小（字节） | `12345678` |

**关键理解**：`latest.yml` 告诉 Electron 的自动更新模块"最新版本是什么、在哪里下载、文件大小和校验和是多少"。如果 `latest.yml` 没有正确更新，用户即使安装了旧版本，也无法自动更新到新版本。

### 2.4 校验和文件（`SHA256SUMS`）

`SHA256SUMS` 文件包含所有产物的 SHA256 校验和：

```
abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890  OriginOS CE-0.1.47-x64.exe
fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321  OriginOS CE-0.1.47-arm64.dmg
```

**作用**：用户可以通过校验和验证下载的文件是否完整、未被篡改。

**使用方法**：

```bash
# Linux/macOS
shasum -a 256 -c SHA256SUMS

# Windows
Get-FileHash -Algorithm SHA256 "OriginOS CE-0.1.47-x64.exe"
```

## 3. 产物完整性的判断

### 3.1 完整的产物应该包含什么

一个完整的发布产物应该包含：

| 平台 | 必需文件 | 可选文件 |
| --- | --- | --- |
| Windows | `.exe`、`.exe.blockmap` | `.zip` |
| macOS ARM64 | `.dmg`、`.dmg.blockmap` | `.zip` |
| macOS x64 | `.dmg`、`.dmg.blockmap` | `.zip` |
| 所有平台 | `latest.yml`、`SHA256SUMS` | — |

### 3.2 产物缺失的排查

如果某个文件缺失，可能的原因：

| 缺失文件 | 可能原因 | 影响 |
| --- | --- | --- |
| `.exe` 或 `.dmg` | 构建失败 | 用户无法安装 |
| `.blockmap` | Electron Builder 配置错误 | 自动更新变慢（回退到完整下载） |
| `latest.yml` | 发布脚本未执行或执行失败 | 自动更新不可用 |
| `SHA256SUMS` | 发布脚本未执行 | 用户无法验证文件完整性 |

## 4. 文档覆盖台账

| 本课直接精读的内容 | 精读范围 | 配对验证 | 本课只证明什么 |
| --- | --- | --- | --- |
| `release/` 目录结构 | 目录列表 | 对照 `electron-builder.yml` 验证 | 产物文件的种类和命名规则 |
| `latest.yml` 格式 | 示例内容 | 对照 Electron 自动更新文档验证 | 自动更新元数据的结构 |
| `SHA256SUMS` 格式 | 示例内容 | 对照 SHA256 标准验证 | 校验和文件的格式和用途 |

本课没有精读的内容也要明说：

- `.blockmap` 文件的内部格式未精读（二进制格式）
- Electron Builder 生成产物的详细逻辑未精读
- 各产物的内部结构（如 `.exe` 的 NSIS 脚本、`.dmg` 的磁盘布局）未精读

## 5. 练习：产物阅读

### 任务 A：判断产物完整性

已知信息：`release/` 目录下有 `OriginOS CE-0.1.47-x64.exe` 但没有 `OriginOS CE-0.1.47-x64.exe.blockmap`。

问题：这个产物完整吗？缺少 `.blockmap` 会有什么影响？

### 任务 B：理解自动更新机制

已知信息：用户安装了 OriginOS CE 0.1.46，但无法自动更新到 0.1.47。

问题：应该检查哪些文件？可能的原因是什么？

### 任务 C：验证文件完整性

已知信息：用户从官网下载了 `OriginOS CE-0.1.47-x64.exe`，想验证文件是否完整。

问题：应该怎么做？需要哪些文件？

### 参考答案

**任务 A：**

| 判断 | 说明 |
| --- | --- |
| 产物基本完整 | `.exe` 存在，用户可以直接安装 |
| 缺少 `.blockmap` | 自动更新时会回退到完整下载，更新速度变慢 |
| 不影响功能 | 只是更新效率问题，不影响正常使用 |

**任务 B：**

| 排查步骤 | 操作 |
| --- | --- |
| 1 | 检查 `latest.yml` 是否包含 0.1.47 的版本信息 |
| 2 | 检查 `latest.yml` 的 URL 是否正确指向产物 |
| 3 | 检查 Electron 的自动更新配置 |
| 4 | 检查网络连接 |

可能原因：`latest.yml` 未更新、自动更新配置错误、网络问题。

**任务 C：**

| 步骤 | 操作 |
| --- | --- |
| 1 | 下载 `SHA256SUMS` 文件 |
| 2 | 使用 `shasum -a 256 -c SHA256SUMS` 验证 |
| 3 | 或者手动计算 SHA256 校验和，与 `SHA256SUMS` 中的值对比 |

## 6. 口头验收

学完本课后，不看正文也应能回答下面五个问题：

1. `release/` 目录下有哪些类型的文件？每种文件的作用是什么？
2. `.blockmap` 文件的作用是什么？如果缺失会有什么影响？
3. `latest.yml` 的作用是什么？它包含哪些关键字段？
4. 如何判断一个产物是否完整？需要检查哪些文件？
5. 用户如何验证下载的文件是否完整？

合格回答不要求背诵每个文件的具体格式，但必须能说清产物文件的种类、作用、以及完整性判断方法。能说清"每个文件的用途"比只说清"目录下有哪些文件"更重要。
