# K15 · WorkspaceService 与 LocalFileSystem：文件读写与路径安全

> **课号** K15 · **轨道** T13 · **文件** `packages/desktop/src/main/services/workspace-service.ts`、`packages/desktop/src/main/local-fs.ts` · **预计阅读** 35 分钟

---

## 本课要回答的问题

桌面版怎样读写文件？`workspace:file:read` 和 `workspace:file:write` 怎样工作？`LocalFileSystem` 怎样防止路径遍历攻击？

## 概念阶梯

### 第一层：文件读写流程

```textnrenderer → IPC workspace:file:read → WorkspaceService.readFile()
  → LocalFileSystem.readFile()
  → 读取文件内容
  → 返回给 renderer

renderer → IPC workspace:file:write → WorkspaceService.writeFile()
  → LocalFileSystem.writeFile()
  → 写入文件内容
  → 返回成功
```

### 第二层：路径安全

`LocalFileSystem` 使用路径白名单防止路径遍历攻击：

```textn请求路径
  → assertAllowed(path)
  → 检查是否在白名单内
  → 是：继续执行
  → 否：抛出 PathNotAllowedError
```

### 第三层：文件上传

支持大文件上传（500MB 限制）：

```textnrenderer → IPC workspace:file:upload → WorkspaceService.uploadFile()
  → 分块接收
  → 写入临时文件
  → 合并到目标路径
```

## 源码窗口

### 窗口 1：LocalFileSystem 路径白名单（local-fs.ts 第 1–80 行）

```typescript
const ALLOWED_PATHS = [
  '/data',
  '/projects',
  '/skills',
  '/agents',
];

function assertAllowed(filePath: string): void {
  const normalized = path.normalize(filePath);
  const isAllowed = ALLOWED_PATHS.some(allowed => 
    normalized.startsWith(path.join(DATA_ROOT, allowed))
  );
  
  if (!isAllowed) {
    throw new PathNotAllowedError(`Path not allowed: ${filePath}`);
  }
}
```

### 窗口 2：文件读取（workspace-service.ts 第 1–120 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.WORKSPACE_FILE_READ,
  async (_event, request): Promise<IpcResponse<string>> => {
    try {
      const content = await localFileSystem.readFile(request.path);
      return { success: true, data: content };
    } catch (error) {
      return { success: false, error: { code: 'FILE_READ_FAILED', message: String(error) } };
    }
  }
);
```

### 窗口 3：文件写入（workspace-service.ts 第 121–250 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.WORKSPACE_FILE_WRITE,
  async (_event, request): Promise<IpcResponse<void>> => {
    try {
      await localFileSystem.writeFile(request.path, request.content);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: { code: 'FILE_WRITE_FAILED', message: String(error) } };
    }
  }
);
```

### 窗口 4：文件上传（workspace-service.ts 第 251–400 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.WORKSPACE_FILE_UPLOAD,
  async (event, request): Promise<IpcResponse<void>> => {
    try {
      const MAX_SIZE = 500 * 1024 * 1024; // 500MB
      
      if (request.size > MAX_SIZE) {
        return { success: false, error: { code: 'FILE_TOO_LARGE', message: 'File size exceeds 500MB' } };
      }
      
      await localFileSystem.writeFile(request.path, request.content);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: { code: 'FILE_UPLOAD_FAILED', message: String(error) } };
    }
  }
);
```

## 失败路径

### 失败 1：路径遍历攻击

如果请求路径包含 `../`，`assertAllowed()` 抛出 `PathNotAllowedError`。

### 失败 2：文件不存在

如果文件不存在，`readFile()` 抛出异常，返回 `FILE_NOT_FOUND` 错误。

### 失败 3：磁盘空间不足

如果磁盘空间不足，`writeFile()` 抛出异常，返回 `DISK_FULL` 错误。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么需要路径白名单？
2. 文件上传为什么要限制大小？

<details>
<summary>参考答案</summary>

1. 防止路径遍历攻击，确保只能访问允许的目录。

2. 防止大文件上传导致内存溢出或磁盘空间不足。

</details>

## 口头验收

完成本课后，你应该能用 45 秒口头描述：

> "`WorkspaceService` 处理文件读写和上传。`LocalFileSystem` 使用路径白名单防止路径遍历攻击，只允许访问 `/data`、`/projects` 等目录。文件上传限制 500MB，防止内存溢出。`workspace:file:read` 读取文件，`workspace:file:write` 写入文件，`workspace:file:upload` 处理大文件上传。"

## 下一课预告

K15 讲了文件服务。K16 会看 `CollaborationService` 怎样处理多 Agent 协作。
