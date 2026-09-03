# J45：OntologyGraph 与力导向布局

## Canvas 手写的力导向图

`OntologyGraph` 是访谈窗口右侧的核心可视化组件。它不用 d3 或其他可视化库，而是纯手写 Canvas 力导向布局。这节课读这个组件，理解如何从零实现一个力导向图。

## 第一段源码：节点与边的数据结构

[packages/web/src/components/interview/OntologyGraph.tsx 第 6–24 行](../../../../packages/web/src/components/interview/OntologyGraph.tsx#L6)：

```tsx
interface GraphNode {
  id: string;
  name: string;
  type: 'entity' | 'class' | 'relationship' | 'property' | 'rule';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface GraphLink {
  source: string;
  target: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string; // Relationship name to display on edge
}
```

`GraphNode` 比 `OntologyNode` 多了物理模拟所需的字段：

- `x` / `y`：当前位置；
- `vx` / `vy`：当前速度；
- `radius`：节点半径（用于绘制和碰撞检测）；
- `color`：节点颜色。

`GraphLink` 用 `source` / `target` 指向节点 ID，`label` 用于在边上显示关系名称。

## 第二段源码：节点半径与颜色映射

[packages/web/src/components/interview/OntologyGraph.tsx 第 40–52 行](../../../../packages/web/src/components/interview/OntologyGraph.tsx#L40)：

```tsx
const getNodeRadius = (type: string) => {
  switch (type) {
    case 'entity': return 24;
    case 'class': return 20;
    case 'relationship': return 16;
    case 'property': return 12;
    default: return 16;
  }
};

const getNodeColor = (type: string) => {
  return COLORS[type as keyof typeof COLORS] || COLORS.entity;
};
```

不同类型的节点有不同的视觉权重：

- `entity` 最大（24px），因为它是核心概念；
- `class` 次之（20px）；
- `relationship` 和 `property` 更小。

颜色用 `COLORS` 常量定义，`entity` 是蓝色，`class` 是紫色，`relationship` 是琥珀色，`property` 是绿色。

## 第三段源码：从 OntologyModel 到 GraphNode

[packages/web/src/components/interview/OntologyGraph.tsx 第 74–130 行](../../../../packages/web/src/components/interview/OntologyGraph.tsx#L74)：

```tsx
  // 当 ontology 变化时计算节点位置（保留现有节点位置）
  useEffect(() => {
    if (!ontology) {
      nodesRef.current = [];
      linksRef.current = [];
      setNodeCount(0);
      setLinkCount(0);
      return;
    }

    // 从现有节点复制位置和速度
    const existingNodesMap = new Map(nodesRef.current.map(n => [n.name, {
      x: n.x,
      y: n.y,
      vx: n.vx,
      vy: n.vy,
    }]));

    const processedNodes = new Set<string>();
    const newNodes: GraphNode[] = [];
    const newLinks: GraphLink[] = [];

    // 处理实体/类节点 (DO NOT include property nodes)
    const entityNodes = ontology.nodes.filter(
      n => n.type === 'entity' || n.type === 'class'
    );

    // 使用圆形布局
    const centerX = 300;
    const centerY = 300;
    const radius = Math.min(200, 50 + entityNodes.length * 15);

    entityNodes.forEach((node, index) => {
      if (processedNodes.has(node.name)) return;
      processedNodes.add(node.name);

      const existingPos = existingNodesMap.get(node.name);
      const angle = (index / Math.max(1, entityNodes.length)) * Math.PI * 2 - Math.PI / 2;

      // 如果节点已存在，保留位置；否则使用圆形布局
      const targetX = existingPos?.x ?? centerX + Math.cos(angle) * radius;
      const targetY = existingPos?.y ?? centerY + Math.sin(angle) * radius;

      newNodes.push({
        id: node.id,
        name: node.name,
        type: node.type as any,
        x: targetX,
        y: targetY,
        vx: existingPos?.vx ?? 0,
        vy: existingPos?.vy ?? 0,
        radius: getNodeRadius(node.type),
        color: getNodeColor(node.type),
      });
    });
```

当 `ontology` 变化时，组件会重新计算节点：

1. 先过滤出 `entity` 和 `class` 类型的节点，忽略 `property`；
2. 用 `existingNodesMap` 保留已有节点的位置和速度，避免每次数据更新都重新布局；
3. 新节点用圆形布局初始化位置，半径随节点数量动态调整；
4. 用 `processedNodes` 去重，防止同名节点重复添加。

> 这里有个细节：`type: node.type as any` 绕过了类型检查，因为 `OntologyNode.type` 可能是 `rule`，但 `GraphNode.type` 没有包含 `rule`。这是类型系统与实际数据不一致的妥协。

## 第四段源码：关系节点转边

[packages/web/src/components/interview/OntologyGraph.tsx 第 131–195 行](../../../../packages/web/src/components/interview/OntologyGraph.tsx#L131)：

```tsx
    // 处理关系节点 - Create direct edges between entities
    const relationshipNodes = ontology?.nodes.filter(n => n.type === 'relationship') ?? [];

    // Create reverse mapping from Chinese to English for entity lookup
    const chineseToEnglishMap = new Map<string, string>();
    const commonEntityNames: Record<string, string> = {
      'Order': '订单',
      'WorkOrder': '生产任务',
      'Material': '物料',
      'Delivery': '物流',
      'ExceptionEvent': '异常事件',
      'Customer': '客户',
      'Supplier': '供应商',
      'User': '用户',
      'Product': '产品',
      'Task': '任务',
    };

    // Build the mapping from the actual nodes
    newNodes.forEach(node => {
      for (const [eng, chi] of Object.entries(commonEntityNames)) {
        if (node.name === chi) {
          chineseToEnglishMap.set(chi, eng);
          break;
        }
      }
    });

    relationshipNodes.forEach((node) => {
      const parts = node.name.split('→').map(s => s.trim());
      if (parts.length >= 2 && parts[0] && parts[1]) {
        const chineseFrom = parts[0];
        const chineseTo = parts[1];

        const sourceNode = newNodes.find(n => n.name === chineseFrom);
        const targetNode = newNodes.find(n => n.name === chineseTo);

        if (sourceNode && targetNode) {
          const relationshipLabel = node.description?.match(/^([^\(]+)/)?.[1]?.trim() || '';

          newLinks.push({
            source: sourceNode.id,
            target: targetNode.id,
            sourceNodeId: chineseFrom,
            targetNodeId: chineseTo,
            label: relationshipLabel,
          });
        } else {
          if (!sourceNode) {
            console.warn(`[OntologyGraph] Source node not found for relationship: ${chineseFrom} → ${chineseTo}`);
          }
          if (!targetNode) {
            console.warn(`[OntologyGraph] Target node not found for relationship: ${chineseFrom} → ${chineseTo}`);
          }
        }
      } else {
        console.warn(`[OntologyGraph] Invalid relationship format: ${node.name}`);
      }
    });
```

关系节点的处理比较特殊：

1. `OntologyModel` 里的 `relationship` 节点用 `"订单→客户"` 这种字符串表示关系；
2. 代码按 `→` 拆分，得到 `from` 和 `to`；
3. 在 `newNodes` 里查找对应的实体节点；
4. 如果找到，创建一条边，并从 `description` 里提取关系标签（如 `"包含"`）；
5. 如果找不到，打印警告。

> 这里有一个硬编码的 `commonEntityNames` 映射，把中文实体名转成英文。这说明后端生成的本体可能用英文 ID，但前端显示用中文，需要双向转换。这种硬编码映射在快速迭代期很常见，但长远看应该用配置或数据库驱动。

## 第五段源码：力导向模拟的物理参数

[packages/web/src/components/interview/OntologyGraph.tsx 第 203–289 行](../../../../packages/web/src/components/interview/OntologyGraph.tsx#L203)：

```tsx
  // 力导向模拟
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nodes = nodesRef.current || [];
    const links = linksRef.current || [];

    if (nodes.length === 0) return;

    let lastTimestamp = 0;

    const simulate = (timestamp: number) => {
      const deltaTime = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      // 物理参数
      const k = 0.01;  // 弹簧常数
      const repulsion = 2000;  // 斥力
      const damping = 0.9;  // 阻尼
      const speed = Math.min(deltaTime / 16, 2); // 时间步长限制

      // 计算力
      // 1. 斥力（节点之间互斥）
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const ni = nodes[i]!;
          const nj = nodes[j]!;
          const dx = nj.x - ni.x;
          const dy = nj.y - ni.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repulsion / (dist * dist);
          const fx = (dx / dist) * force * speed;
          const fy = (dy / dist) * force * speed;

          ni.vx -= fx;
          ni.vy -= fy;
          nj.vx += fx;
          nj.vy += fy;
        }
      }

      // 2. 弹簧力（连接的节点互相吸引）
      for (const link of links) {
        const source = nodes.find(n => n.id === link.source);
        const target = nodes.find(n => n.id === link.target);
        if (!source || !target) continue;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const force = (dist - 100) * k * speed;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }

      // 3. 中心引力（防止节点飞得太远）
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      for (const node of nodes) {
        const dx = centerX - node.x;
        const dy = centerY - node.y;
        node.vx += dx * 0.0005 * speed;
        node.vy += dy * 0.0005 * speed;
      }

      // 更新位置
      for (const node of nodes) {
        node.vx *= damping;
        node.vy *= damping;
        node.x += node.vx * speed;
        node.y += node.vy * speed;

        // 边界约束
        const padding = node.radius + 10;
        node.x = Math.max(padding, Math.min(canvas.width - padding, node.x));
        node.y = Math.max(padding, Math.min(canvas.height - padding, node.y));
      }
```

力导向模拟的核心是三种力：

1. **斥力**：所有节点两两互斥，力的大小与距离平方成反比（`repulsion / dist²`）；
2. **弹簧力**：连接的节点互相吸引，力的大小与距离偏离目标长度（100px）成正比；
3. **中心引力**：所有节点被拉向画布中心，防止飞散。

物理参数：

- `k = 0.01`：弹簧常数，控制吸引力强度；
- `repulsion = 2000`：斥力系数；
- `damping = 0.9`：阻尼，每帧速度衰减 10%；
- `speed`：时间步长，限制最大 2 倍速，防止快速帧率变化导致模拟不稳定。

> 如果 `damping` 改成 0.5，节点会更快停下来，但可能达不到平衡态；如果改成 0.99，节点会振荡很久才稳定。

## 第六段源码：Canvas 绘制

[packages/web/src/components/interview/OntologyGraph.tsx 第 291–390 行](../../../../packages/web/src/components/interview/OntologyGraph.tsx#L291)：

```tsx
      // 绘制
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制连接线
      for (const link of links) {
        if (!link) continue;
        const source = nodes.find(n => n.id === link.source);
        const target = nodes.find(n => n.id === link.target);
        if (!source || !target) continue;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);

        // 渐变色连接线
        const gradient = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
        gradient.addColorStop(0, source.color + '60');
        gradient.addColorStop(1, target.color + '60');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw relationship label on edge if available
        if (link.label) {
          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;

          ctx.font = '10px system-ui';
          const textWidth = ctx.measureText(link.label).width;
          const padding = 4;

          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.beginPath();
          ctx.roundRect(midX - textWidth/2 - padding, midY - 8, textWidth + padding*2, 16, 4);
          ctx.fill();

          ctx.fillStyle = '#6B7280';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(link.label, midX, midY);
        }
      }

      // 绘制节点
      for (const node of nodes) {
        const isHovered = hoveredNodeRef.current === node.id;
        const isSelected = selectedEntity === node.name;

        // 绘制节点阴影
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color + '20';
        ctx.fill();

        // 绘制节点主体
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = (isSelected || isHovered) ? node.color : node.color + 'CC';
        ctx.fill();

        // 绘制边框
        if (isSelected) {
          ctx.strokeStyle = node.color;
          ctx.lineWidth = 4;
          ctx.stroke();
        } else if (isHovered) {
          ctx.strokeStyle = node.color;
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // 文字标签
        ctx.fillStyle = '#1F2937';
        ctx.font = isHovered ? 'bold 12px system-ui' : '11px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 超长文本截断
        const maxTextWidth = node.radius * 2.5;
        let text = node.name;
        if (ctx.measureText(text).width > maxTextWidth) {
          while (ctx.measureText(text + '...').width > maxTextWidth && text.length > 3) {
            text = text.slice(0, -1);
          }
          text += '...';
        }

        ctx.fillText(text, node.x, node.y + node.radius + 15);

        // 类型徽章
        if (node.type === 'entity' || node.type === 'class') {
          ctx.font = '10px system-ui';
          ctx.fillStyle = '#6B7280';
          ctx.fillText(node.type === 'entity' ? '实体' : '类', node.x, node.y);
        }
      }
```

绘制顺序：

1. 先画边，用渐变色（从源节点颜色到目标节点颜色）；
2. 如果边有标签，在中间画白底文字；
3. 再画节点，先画阴影（半透明大圆），再画主体（选中/悬停时不透明，否则半透明）；
4. 选中节点画粗边框，悬停节点画细边框；
5. 最后画文字标签，超长文本截断加 `...`，并在节点中心画类型徽章。

> 注意 `node.color + '60'` 这种字符串拼接生成半透明颜色，是 Canvas 的常见技巧，但不如 CSS 的 `rgba` 直观。

## 第七段源码：鼠标交互

[packages/web/src/components/interview/OntologyGraph.tsx 第 404–454 行](../../../../packages/web/src/components/interview/OntologyGraph.tsx#L404)：

```tsx
  // 处理交互
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    let found = null;
    for (const node of nodesRef.current) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (Math.sqrt(dx * dx + dy * dy) <= node.radius + 5) { // +5px tolerance for easier clicking
        found = node.id;
        break;
      }
    }

    hoveredNodeRef.current = found;
    canvas.style.cursor = found ? 'pointer' : 'default';
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Recalculate hit on click for reliability
    let found = null;
    for (const node of nodesRef.current) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (Math.sqrt(dx * dx + dy * dy) <= node.radius + 5) {
        found = node;
        break;
      }
    }

    if (found && (found.type === 'entity' || found.type === 'class')) {
      console.log('[OntologyGraph] Node clicked:', found.name);
      onEntityClick?.(found.name);
    }
  };
```

鼠标交互分两步：

1. `handleMouseMove`：计算鼠标在 Canvas 内的坐标，遍历节点检查是否在半径范围内（+5px 容差），更新 `hoveredNodeRef` 并改变光标；
2. `handleClick`：重新计算命中，如果点击的是 `entity` 或 `class`，调用 `onEntityClick` 回调。

> 这里用 `useRef` 存储 `hoveredNodeRef` 而不是 `useState`，是为了避免每次悬停变化都触发重新渲染。Canvas 绘制由 `requestAnimationFrame` 驱动，不依赖 React 状态。

## 第八段源码：Canvas 尺寸与空状态

[packages/web/src/components/interview/OntologyGraph.tsx 第 456–476 行](../../../../packages/web/src/components/interview/OntologyGraph.tsx#L456)：

```tsx
  // 设置 canvas 尺寸
  const canvasSize = { width: 600, height: 600 };

  return (
    <div className={`relative ${className}`} style={{ width: canvasSize.width, height: canvasSize.height }}>
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        className="w-full h-full"
      />
      {nodeCount === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
          暂无实体数据
        </div>
      )}
    </div>
  );
}
```

Canvas 固定 600×600，但用 `className="w-full h-full"` 让它填满容器。父容器可以通过 `scale-75` 或其他方式缩放。

当 `nodeCount === 0` 时，显示"暂无实体数据"的空状态提示。

## 本节小结

- `OntologyGraph` 是纯 Canvas 手写的力导向图，不用 d3 等可视化库。
- 物理模拟包含三种力：斥力、弹簧力、中心引力，通过 `damping` 控制稳定速度。
- 节点位置在 `ontology` 变化时保留已有位置，避免重新布局导致视觉跳变。
- 关系节点用 `"A → B"` 字符串表示，代码拆分后查找对应实体创建边。
- 鼠标交互用 `useRef` 存储悬停状态，避免频繁触发 React 重新渲染。
- 硬编码的 `commonEntityNames` 映射是快速迭代的产物，长远看应该配置化。

下一节课读工作区入口 `WorkspaceWindow` 和 `ProjectWorkspace`，看文件管理和本体编辑如何组织。
