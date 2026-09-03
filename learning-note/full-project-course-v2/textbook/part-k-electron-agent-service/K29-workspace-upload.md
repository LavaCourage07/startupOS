# K29 · WorkspaceService：文件上传与路径安全

> **课号** K29 · **轨道** T13 · **文件** `packages/desktop/src/main/services/workspace-service.ts` · **预计阅读** 30 分钟

---

## 本课要回答的问题

`WorkspaceService` 怎样处理文件上传？路径白名单怎样工作？`assertAllowed()` 怎样防止路径遍历攻击？

## 概念阶梯

### 第一层：路径白名单

```textn请求路径
  → assertAllowed(path)
  → 检查是否在白名单内
  → 是：继续执行
  → 否：抛出 PathNotAllowedError
```

### 第二层：文件上传

```textn上传请求
  → 检查文件大小（500MB 限制）
  → 解码内容
  → 写入文件
```

### 第三层：路径解析

```textnentryType + entryId
  → resolveProjectDir()
  → 返回 baseDir、entryId、ontologyId
```

## 源码窗口

### 窗口 1：路径白名单（第 23–38 行）

```typescript
const ALLOWED_BASES = [
  getDataRoot(),
  path.join(getDataRoot(), 'skills'),
  path.join(getMonorepoRoot(), 'skills'),
  path.join(getMonorepoRoot(), 'tmp'),
];

function assertAllowed(p: string): void {
  const normalized = resolveWorkspaceBasePath(p, {
    dataRoot: getDataRoot(),
    monorepoRoot: getMonorepoRoot(),
  });
  if (!ALLOWED_BASES.some((base) => isPathWithin(normalized, base))) {
    throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' });
  }
}
```

### 窗口 2：文件上传（第 68–87 行）

```typescript
const MAX_UPLOAD_FILE_SIZE = 500 * 1024 * 1024; // 500MB

function decodeUploadContent(file: { name: string; content: unknown; encoding?: string }): Buffer {
  if (file.encoding === 'base64') {
    if (typeof file.content !== 'string') {
      throw new Error(`Invalid upload payload for "${file.name}": base64 content must be a string`);
    }
    return Buffer.from(file.content, 'base64');
  }
  if (typeof file.content === 'string') {
    return Buffer.from(file.content, 'base64');
  }
  if (file.content instanceof ArrayBuffer) {
    return Buffer.from(file.content);
  }
  if (ArrayBuffer.isView(file.content)) {
    return Buffer.from(file.content.buffer, file.content.byteOffset, file.content.byteLength);
  }
  throw new Error(`Invalid upload payload for "${file.name}": unsupported content type ${Object.prototype.toString.call(file.content)}`);
}
```

### 窗口 3：路径解析（第 40–66 行）

```typescript
async function resolveProjectDir(entryId: string): Promise<{ baseDir: string; entryId: string; ontologyId: string }> {
  const projectsRoot = path.join(getDataRoot(), 'projects');
  const candidates = [
    entryId,
    entryId.startsWith('project-') ? entryId.slice('project-'.length) : null,
    `project-${entryId}`,
  ].filter((id): id is string => Boolean(id));

  for (const candidate of [...new Set(candidates)]) {
    const baseDir = path.join(projectsRoot, candidate);
    try {
      const stats = await fs.stat(baseDir);
      if (stats.isDirectory()) {
        return { baseDir, entryId: candidate, ontologyId: `ontology-${candidate}` };
      }
    } catch {
      // Try next compatibility candidate.
    }
  }

  const fallbackId = entryId.startsWith('project-') ? entryId.slice('project-'.length) : entryId;
  return {
    baseDir: path.join(projectsRoot, fallbackId),
    entryId: fallbackId,
    ontologyId: `ontology-${fallbackId}`,
  };
}
```

## 失败路径

### 失败 1：路径不在白名单

如果路径不在白名单内，`assertAllowed()` 抛出 `FORBIDDEN` 错误。

### 失败 2：文件超过 500MB

如果文件大小超过 500MB，返回 `FILE_TOO_LARGE` 错误。

### 失败 3：解码失败

如果文件内容格式错误，`decodeUploadContent()` 抛出异常。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么需要路径白名单？
2. `decodeUploadContent` 支持哪些编码？

<details>
<summary>参考答案</summary>

1. 防止路径遍历攻击，确保只能访问允许的目录。

2. 支持 base64、string、ArrayBuffer、ArrayBufferView。

</details>

## 口头验收

完成本课后，你应该能用 45 秒口头描述：

> "`WorkspaceService` 使用路径白名单防止路径遍历攻击。`assertAllowed()` 检查路径是否在白名单内。文件上传限制 500MB，`decodeUploadContent()` 支持多种编码。`resolveProjectDir()` 解析项目目录。"

## 下一课预告

K29 讲了文件上传。K30 是单元小结课，把 K26–K29 的知识重新组织成系统能力。
