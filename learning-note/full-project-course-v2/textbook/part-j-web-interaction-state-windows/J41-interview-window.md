# J41：InterviewWindow —— AI 访谈式项目创建

## 第二种创建入口：边聊边建模

如果说 `ProjectCreationWizard` 是“填表式”创建，那 `InterviewWindow` 就是“对话式”创建。它左侧是一个对话面板，右侧是一个实时刷新的业务模型面板。Agent 在对话中不断提取业务概念，并把结果写入 `business-model.json`，右侧 UI 监听文件变化后把 JSON 转成图谱展示出来。

## 第一段源码：入口 props 与 ID 规范化

[packages/web/src/components/interview/InterviewWindow.tsx 第 390–410 行](../../../../packages/web/src/components/interview/InterviewWindow.tsx#L390)：

```tsx
export function InterviewWindow({ projectId, sessionId, projectName, ontologyId, onClose, onComplete }: InterviewWindowProps) {
  const resolvedProjectId = useMemo(
    () => projectId ? normalizeProjectEntryId(projectId) : `interview-${Date.now()}`,
    []
  );
  const resolvedOntologyId = useMemo(
    () => normalizeOntologyId(ontologyId, resolvedProjectId),
    [ontologyId, resolvedProjectId]
  );
  const resolvedSessionId = useMemo(
    () => sessionId ?? `project-initialization-${Date.now()}`,
    []
  );
  const resolvedProjectName = useMemo(
    () => projectName ?? '项目访谈',
    []
  );
```

`InterviewWindow` 接收的 `projectId` 可能带各种前缀，比如 `project-proj-xxx`、`ontology_xxx`。它通过 `project-identity.ts` 里的两个工具函数做规范化：

- `normalizeProjectEntryId`：去掉 `project-` / `project-proj-` 前缀，得到干净的 `proj-xxx` 或原始 ID。
- `normalizeOntologyId`：把 `ontology_xxx`、`ontology-project-xxx` 等格式统一转成 `ontology-xxx`。

这一步非常关键。如果 ID 不一致，后续 `loadProjectArtifacts`、`updateProject`、`syncProjectOntology` 都会找不到数据。

## 第二段源码：持久化 Agent 与对话能力

[packages/web/src/components/interview/InterviewWindow.tsx 第 431–440 行](../../../../packages/web/src/components/interview/InterviewWindow.tsx#L431)：

```tsx
  const {
    isReady: isInitialized,
    isThinking,
    messages: piMessages,
    toolExecutions,
    artifactVersion,
    sendMessage: sendMessageStream,
    triggerGreeting,
    abort,
  } = usePersistentAgent(resolvedProjectId, llmConfig);
```

`InterviewWindow` 不直接调用 `usePiAgent`，而是调用 Core 里更高层的 `usePersistentAgent`。这个 Hook 已经封装好了：

- 按 `projectId` 加载 Project Agent 上下文；
- 恢复历史消息；
- 提供 `sendMessage`、`triggerGreeting`、`abort` 等方法；
- 返回 `toolExecutions` 和 `artifactVersion` 用于刷新右侧面板。

Web 层只需要关心“什么时候发消息、什么时候刷新模型”。

## 第三段源码：头部与阶段徽章

[packages/web/src/components/interview/InterviewWindow.tsx 第 35–134 行](../../../../packages/web/src/components/interview/InterviewWindow.tsx#L35)：

```tsx
const PHASE_BADGE: Record<string, { label: string; className: string }> = {
  empty: { label: '准备中', className: 'bg-muted text-text-secondary border border-border' },
  collecting: { label: '发现中', className: 'bg-primary/15 text-primary border border-primary/30' },
  generating: { label: '生成中', className: 'bg-amber-500/15 text-amber-700 border border-amber-500/30' },
  preview: { label: '已完成', className: 'bg-teal-500/15 text-teal-600 border border-teal-500/30' },
};
```

头部 `InterviewHeader` 显示项目名称、阶段徽章，并在 `projectId` 存在时提供两个快捷按钮：

- **打开项目管理**：调用 `AppWindowManager.openComponentWindow` 打开 `ProjectWorkspace`。
- **打开文件工作区**：调用 `AppWindowManager.openComponentWindow` 打开 `WorkspaceWindow`。

这两个按钮说明 `InterviewWindow` 不是孤立窗口，它是项目生命周期的一个节点，可以随时跳到工作区继续操作。

## 第四段源码：加载项目产出物

[packages/web/src/components/interview/InterviewWindow.tsx 第 212–243 行](../../../../packages/web/src/components/interview/InterviewWindow.tsx#L212)：

```tsx
async function loadProjectArtifacts(projectId: string): Promise<{
  hasBusinessModel: boolean;
  businessModel?: any;
  phase: 'empty' | 'collecting' | 'generating' | 'preview';
}> {
  try {
    const result = await getProjectArtifact(projectId, 'business-model');
    if (result.success && result.data) {
      return {
        hasBusinessModel: true,
        businessModel: result.data,
        phase: 'preview',
      };
    }
  } catch (e) {
    console.error('[InterviewWindow] Failed to load artifacts:', e);
  }

  return {
    hasBusinessModel: false,
    phase: 'empty',
  };
}
```

组件挂载后会调用 `loadProjectArtifacts`：

1. 先调用 `initializeProject` 确保项目输出目录存在；
2. 再读取 `business-model.json`；
3. 如果存在，直接转换成 `OntologyModel`，并把 `displayMode` 设为 `'preview'`。

这意味着如果用户之前已经访谈过，再次打开窗口会直接展示已有模型，而不是从头开始。

## 第五段源码：业务模型转本体

[packages/web/src/components/interview/InterviewWindow.tsx 第 257–382 行](../../../../packages/web/src/components/interview/InterviewWindow.tsx#L257)：

```tsx
function businessModelToOntology(model: any): OntologyModel {
  const now = Date.now();
  const nodes = [];

  if (model.entities && Array.isArray(model.entities)) {
    const entityMap = new Map<string, string>();

    for (const entity of model.entities) {
      if (typeof entity === 'string') {
        const nodeId = `entity-${entity}-${now}`;
        entityMap.set(entity, nodeId);
        nodes.push({ id: nodeId, name: entity, type: 'entity' as const, description: '', children: [] });
        continue;
      }

      const entityName = entity.name || entity.label || String(entity);
      const nodeId = `entity-${entityName}-${now}`;
      entityMap.set(entityName, nodeId);

      const children = Object.entries(entity.properties || {}).map(([key, value], i) => ({
        id: `prop-${key}-${i}`,
        name: key,
        type: 'property' as const,
        description: String(value),
      }));

      nodes.push({
        id: nodeId,
        name: entityName,
        type: 'entity' as const,
        description: entity.definition || entity.description || '',
        children,
      });
    }

    if (model.relationships && Array.isArray(model.relationships)) {
      for (const rel of model.relationships) {
        if (typeof rel === 'string') {
          const parts = rel.split('→').map(s => s.trim());
          if (parts.length >= 2 && parts[0] && parts[1]) {
            nodes.push({ id: `rel-${rel}-${now}`, name: rel, type: 'relationship' as const, description: '', children: [] });
          }
          continue;
        }

        const fromName = rel.from || '';
        const toName = rel.to || '';
        if (!fromName || !toName) continue;

        nodes.push({
          id: `rel-${fromName}-${toName}-${now}`,
          name: `${fromName} → ${toName}`,
          type: 'relationship' as const,
          description: `${rel.type || ''} (${rel.cardinality || ''})`.trim().replace(/^\(|\)$/g, ''),
          children: [],
        });
      }
    }
  }

  // 转换业务规则 ...

  return {
    id: `ontology-${now}`,
    name: model.projectName || model.title || '业务模型',
    description: model.background || model.description || `行业：${model.industry || '未知'}`,
    nodes,
    createdAt: now,
  };
}
```

这个函数是访谈窗口与右侧图谱之间的“翻译器”。它要处理很多兼容场景：

- `entities` 可能是字符串数组 `["订单", "客户"]`，也可能是对象数组 `{ name, properties }`；
- `relationships` 可能是 `"订单→客户"` 这种字符串，也可能是 `{ from, to, type, cardinality }` 对象；
- 属性被展开成 `children`，用于 `ArtifactDisplayPanel` 的实体卡片展示。

> 这里所有节点 ID 都带了时间戳，意味着每次转换都会重新生成 ID。右侧 Canvas 图谱在数据更新时可能会丢失之前的选中状态，这是当前实现的一个可优化点。

## 第六段源码：自动启动访谈

[packages/web/src/components/interview/InterviewWindow.tsx 第 493–527 行](../../../../packages/web/src/components/interview/InterviewWindow.tsx#L493)：

```tsx
  useEffect(() => {
    if (!isInitialized || hasCheckedHistory.current || piMessages.length > 0 || isThinking) {
      return;
    }

    const shouldAutoStart = async () => {
      hasCheckedHistory.current = true;

      if (hasSessionHistory(piMessages)) {
        console.log('[InterviewWindow] Found existing session history, skipping auto-start');
        return;
      }

      const existingModel = await loadBusinessModelFromOutput(resolvedProjectId);
      if (existingModel) {
        console.log('[InterviewWindow] Existing business model found, triggering review mode');
        const converted = businessModelToOntology(existingModel);
        if (converted.nodes.length > 0) {
          setOntology(converted);
          setDisplayModeSync('preview');
        }
        triggerGreeting().catch(console.error);
      } else {
        console.log('[InterviewWindow] No history found, starting interview');
        sendMessageStream('开始项目访谈').catch(console.error);
      }
    };

    shouldAutoStart().catch(console.error);
  }, [isInitialized]);
```

自动启动逻辑分三种情况：

1. 有历史消息：不触发任何自动消息，让用户继续之前的对话。
2. 没有历史但已有 `business-model.json`：把模型展示出来，然后调用 `triggerGreeting()` 让 Agent 主动打招呼（比如“欢迎回来，我已加载之前的业务模型”）。
3. 完全空白：发送“开始项目访谈”触发 Agent 的访谈流程。

这个 guard 条件和上一单元 `SkillDialog` 的 `shouldAutoStartSession` 异曲同工，都是防止重复触发。

## 第七段源码：工具执行完成后刷新模型

[packages/web/src/components/interview/InterviewWindow.tsx 第 574–615 行](../../../../packages/web/src/components/interview/InterviewWindow.tsx#L574)：

```tsx
  useEffect(() => {
    if (!projectId || toolExecutions.length === 0) return;

    const lastTool = toolExecutions[toolExecutions.length - 1];
    if (!lastTool || lastTool.status !== 'completed') return;

    const result = (lastTool as any).result as Record<string, unknown> | undefined;
    const details = result?.['details'] as Record<string, unknown> | undefined;
    const filePath = ((details?.['filePath'] as string) ?? (result?.['filePath'] as string) ?? '');
    const isModelFile = filePath.includes('business-model.json') || filePath.includes('interview-progress.md');

    if (displayModeRef.current === 'preview' && !isModelFile) return;

    loadLatestModel(resolvedProjectId).then(model => {
      if (!model) return;
      const converted = businessModelToOntology(model);
      if (converted.nodes.length === 0) return;
      setOntology(converted);

      if (displayModeRef.current === 'empty') {
        setDisplayModeSync('collecting');
      }

      if (converted.nodes.length >= 2) {
        setDisplayModeSync('preview');
        handleProjectComplete(model);
      }
    }).catch(console.error);
  }, [toolExecutions, projectId, resolvedProjectId, handleProjectComplete]);
```

这里有两个刷新触发器：

1. **`toolExecutions` 变化**：Agent 写完文件后，最后一个 completed 工具会触发 `loadLatestModel`。
2. **`artifactVersion` 变化**：主进程通过事件通知文件变化时刷新（下一段）。

当识别到至少 2 个节点时，界面从 `collecting` 切到 `preview`，并调用 `handleProjectComplete` 更新项目状态、同步本体。

## 第八段源码：主进程事件刷新

[packages/web/src/components/interview/InterviewWindow.tsx 第 619–637 行](../../../../packages/web/src/components/interview/InterviewWindow.tsx#L619)：

```tsx
  useEffect(() => {
    if (!projectId || artifactVersion === 0) return;

    console.log('[InterviewWindow] artifact_changed detected, refreshing model', { artifactVersion, resolvedProjectId });
    loadLatestModel(resolvedProjectId).then(model => {
      if (!model) return;
      const converted = businessModelToOntology(model);
      if (converted.nodes.length === 0) return;
      setOntology(converted);

      if (displayModeRef.current === 'empty') {
        setDisplayModeSync('collecting');
      }
      if (converted.nodes.length >= 2) {
        setDisplayModeSync('preview');
        handleProjectComplete(model);
      }
    }).catch(console.error);
  }, [artifactVersion, projectId, resolvedProjectId, handleProjectComplete]);
```

`artifactVersion` 是 `usePersistentAgent` 提供的一个版本计数器，主进程里的文件写入操作会递增它。这种方式比轮询更可靠，也比只监听 `toolExecutions` 更通用——因为 Agent 可能通过子进程、外部脚本、甚至用户手动编辑文件来修改产出。

## 本节小结

- `InterviewWindow` 是新版 AI 访谈入口，左侧对话、右侧业务模型实时预览。
- `usePersistentAgent` 提供持久化 Agent 能力，Web 层只负责 UI 刷新和自动启动 guard。
- `businessModelToOntology` 是核心翻译函数，负责把 `business-model.json` 转成 `OntologyModel`。
- 模型刷新有两条路径：`toolExecutions` 变化和 `artifactVersion` 变化。
- 当节点数 ≥ 2 时，界面进入 `preview` 阶段，并触发 `handleProjectComplete` 完成项目创建。

下一节课读 `CUIDialogPanel`、`ArtifactDisplayPanel` 和 `ResizableLayout`，看左右分栏是怎么拼出来的。
