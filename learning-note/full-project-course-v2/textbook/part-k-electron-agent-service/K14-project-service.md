# K14 · ProjectService：项目 CRUD、初始化与本体同步

> **课号** K14 · **轨道** T13 · **文件** `packages/desktop/src/main/services/project-service.ts` · **预计阅读** 35 分钟

---

## 本课要回答的问题

桌面版怎样创建、读取、更新、删除项目？`project:init` 怎样初始化项目结构？项目怎样和本体系统同步？

## 概念阶梯

### 第一层：项目 CRUD

项目是最基本的管理单元，支持以下操作：

```textn创建 (project:create)
  → 生成 projectId
  → 创建项目目录
  → 写入 project.json

读取 (project:get / project:list)
  → 读取 project.json
  → 返回项目元数据

更新 (project:update)
  → 更新 project.json

删除 (project:delete)
  → 删除项目目录
  → 清理相关数据
```

### 第二层：项目初始化

项目初始化 (`project:init`) 创建项目的完整结构：

```textnproject:init
  → 创建项目根目录
  → 创建子目录（src, docs, data 等）
  → 写入初始文件（README.md, .gitignore 等）
  → 初始化本体系统
```

### 第三层：本体同步

项目和本体系统同步，确保项目数据的一致性：

```textn项目创建/更新
  → 同步到本体系统
  → 生成本体文件（ontology.json）
  → 更新项目索引
```

## 源码窗口

### 窗口 1：项目创建（第 1–120 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.PROJECT_CREATE,
  async (_event, request): Promise<IpcResponse<Project>> => {
    try {
      const project = await projectService.createProject({
        name: request.name,
        description: request.description,
        template: request.template,
      });
      return { success: true, data: project };
    } catch (error) {
      return { success: false, error: { code: 'PROJECT_CREATE_FAILED', message: String(error) } };
    }
  }
);
```

### 窗口 2：项目初始化（第 121–250 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.PROJECT_INIT,
  async (_event, request): Promise<IpcResponse<Project>> => {
    try {
      // 1. 创建项目
      const project = await projectService.createProject(request);
      
      // 2. 创建项目目录结构
      await projectService.createProjectStructure(project.id);
      
      // 3. 初始化本体系统
      await ontologyService.initializeForProject(project.id);
      
      // 4. 创建初始文件
      await projectService.createInitialFiles(project.id, request.template);
      
      return { success: true, data: project };
    } catch (error) {
      return { success: false, error: { code: 'PROJECT_INIT_FAILED', message: String(error) } };
    }
  }
);
```

### 窗口 3：本体同步（第 251–400 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.PROJECT_SYNC_ONTOLOGY,
  async (_event, request): Promise<IpcResponse<unknown>> => {
    try {
      // 1. 获取项目数据
      const project = await projectService.getProject(request.projectId);
      
      // 2. 同步到本体系统
      const ontology = await ontologyService.syncProject(project);
      
      // 3. 更新项目索引
      await projectService.updateProjectIndex(request.projectId, {
        ontologyId: ontology.id,
        lastSyncAt: new Date().toISOString(),
      });
      
      return { success: true, data: { ontology } };
    } catch (error) {
      return { success: false, error: { code: 'ONTOLOGY_SYNC_FAILED', message: String(error) } };
    }
  }
);
```

## 失败路径

### 失败 1：项目名重复

如果项目名已存在，`createProject()` 抛出异常，返回 `PROJECT_NAME_EXISTS` 错误。

### 失败 2：目录创建失败

如果磁盘空间不足或权限不足，`createProjectStructure()` 抛出异常。

### 失败 3：本体同步失败

如果本体系统未初始化或数据损坏，`syncProject()` 抛出异常。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么项目初始化要分步骤执行？
2. 本体同步失败会怎样影响项目？

<details>
<summary>参考答案</summary>

1. 分步骤执行便于错误定位和回滚。如果某一步失败，可以知道是哪一步出问题。

2. 本体同步失败不影响项目基本功能，但可能影响依赖本体的功能（如智能推荐）。

</details>

## 口头验收

完成本课后，你应该能用 45 秒口头描述：

> "`ProjectService` 处理项目 CRUD、初始化和本体同步。`project:create` 创建项目，`project:init` 初始化项目结构和本体系统，`project:sync-ontology` 同步项目数据到本体系统。初始化分步骤执行：创建项目、创建目录结构、初始化本体、创建初始文件。"

## 下一课预告

K14 讲了项目服务。K15 会看 `WorkspaceService` 和 `LocalFileSystem` 怎样处理文件读写。
