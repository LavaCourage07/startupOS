## ADDED Requirements

### Requirement: Windows 打包态 Worker 使用合法 ESM module specifier
系统 MUST 在 Windows 打包态 Agent Worker 将本地绝对文件路径传给动态 `import()` 前转换为合法 `file://` URL，不得把盘符路径作为 URL scheme 交给 Node.js ESM loader。

#### Scenario: 从带盘符和空格的安装目录启动 Supervisor
- **WHEN** Windows 安装包从 `K:\originos\OriginOS CE\resources` 启动多 Agent Supervisor
- **THEN** Worker bootstrap SHALL 将本地模块路径转换为 `file:///K:/originos/OriginOS%20CE/...` 形式并完成初始化

#### Scenario: 加载 app.asar 内的 core runtime 模块
- **WHEN** Worker 解析 `resources/app.asar/dist-electron/core/src` 下的运行时模块
- **THEN** 系统 MUST 使用合法 `file://` specifier 执行动态导入，且不得抛出 `ERR_UNSUPPORTED_ESM_URL_SCHEME`

### Requirement: Worker bootstrap 转换保持跨平台兼容
系统 SHALL 在 macOS、Linux 和 Windows 上使用 Node.js 标准 URL 转换语义，并 MUST 保留已经合法的 `file:`、`data:`、`node:` 和 `electron:` specifier。

#### Scenario: POSIX 打包路径
- **WHEN** macOS 或 Linux Worker 加载绝对本地模块路径
- **THEN** 系统 SHALL 生成等价的 `file://` URL 且模块解析行为与修复前一致

#### Scenario: 已有合法 URL
- **WHEN** 转换入口接收到已有支持 scheme 的 module specifier
- **THEN** 系统 MUST 原样返回该 specifier，避免重复转换

### Requirement: 打包验证阻止裸路径动态导入回归
desktop 构建验证 MUST 检查 Agent Worker bootstrap 的路径导入契约，并在发现本地路径直接传给动态 `import()` 时失败。

#### Scenario: 编译产物符合路径导入契约
- **WHEN** CI 执行 Agent Worker runtime verification
- **THEN** 校验 SHALL 确认编译 worker 存在统一转换入口且 bootstrap 依赖均通过该入口加载

#### Scenario: 新增裸 path.join 动态导入
- **WHEN** Worker bootstrap 源码或编译产物重新出现 `import(path.join(...))`
- **THEN** 构建验证 MUST 失败并指出 ESM module specifier 未归一化
