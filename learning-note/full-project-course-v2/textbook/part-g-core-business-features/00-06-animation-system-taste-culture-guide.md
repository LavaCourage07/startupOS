# 单元导读六：动画系统、系统服务、Taste 与 Culture

> 本单元总问题：OriginOS 的动画是怎么设计的？系统服务（错误处理、性能、快捷键）是怎么工作的？Taste 和 Culture 是怎么理解用户偏好的？

## 0. 本页先读什么

如果只记住一句话，记住这一句：

> **动画系统用 Fluent Design 缓动函数和 Web Animations API 实现自然动效；系统服务提供错误边界、性能优化和快捷键；Taste 和 Culture 通过对话分析理解用户偏好。**

## 1. 本单元在讲什么

上一单元（G39–G46）讲的是"文档解析 → API 调用 → 沙箱运行"——系统如何处理外部文档和技能应用。但 OriginOS 还需要：

- **动画系统**：让 UI 动起来，提供流畅的用户体验。
- **系统服务**：错误处理、性能优化、快捷键等底层能力。
- **Taste**：理解用户的品味偏好，个性化系统行为。
- **Culture**：通过对话检测用户的认知风格和文化层特征。

这就是 Animation、System、Taste、Culture 四个模块的职责。

## 2. 本单元的 14 节课

| 课号 | 课题 | 核心问题 |
| --- | --- | --- |
| G47 | 动画缓动函数 | `easings.ts` 定义了哪些 Fluent Design 缓动函数？ |
| G48 | 动画时长常量 | `durations.ts` 定义了哪些动画时长？ |
| G49 | useAnimation Hook | `useAnimation` 是怎么用 Web Animations API 控制动画的？ |
| G50 | useSpring 与 useTransition | 弹簧动画和过渡动画是怎么实现的？ |
| G51 | useReducedMotion | `useReducedMotion` 是怎么检测用户偏好的？ |
| G52 | 错误边界与错误回退 | `ErrorBoundary` 和 `ErrorFallback` 是怎么工作的？ |
| G53 | 性能优化工具 | `LazyLoader`、`VirtualList`、`useMemoryCleanup` 是怎么提升性能的？ |
| G54 | 快捷键系统 | `ShortcutRegistry` 和 `useShortcut` 是怎么管理快捷键的？ |
| G55 | Taste Schema | `taste-schema.ts` 定义了哪些类型和验证函数？ |
| G56 | Context Memory DB | `ContextMemoryDB` 是怎么存储和检索品味记忆的？ |
| G57 | Memory Graph | `MemoryGraph` 是怎么用图结构管理记忆的？ |
| G58 | Culture 类型系统 | `types.ts` 定义了哪些 Culture Detection 类型？ |
| G59 | Culture Detection Service | `CultureDetectionService` 是怎么分析对话提取品味的？ |
| G60 | 单元小结课 | 画出"动画 → 系统 → Taste → Culture"的完整调用链 |

## 3. 本单元涉及的源码文件

```
packages/core/src/lib/features/animations/
├── index.ts                    # 公共 API 导出
├── easings.ts                  # Fluent Design 缓动函数
├── durations.ts                # 动画时长常量
├── useAnimation.ts             # Web Animations API Hook
├── useSpring.ts                # 弹簧动画 Hook
├── useTransition.ts            # 过渡动画 Hook
└── useReducedMotion.ts         # 减少动画偏好检测

packages/core/src/lib/features/system/
├── index.ts                    # 公共 API 导出
├── errors/
│   ├── ErrorBoundary.tsx       # 错误边界组件
│   ├── ErrorFallback.tsx       # 错误回退 UI
│   └── errorReporting.ts       # 错误报告
├── performance/
│   ├── LazyLoader.tsx          # 懒加载
│   ├── VirtualList.tsx         # 虚拟列表
│   └── useMemoryCleanup.ts     # 内存清理 Hook
└── shortcuts/
    ├── ShortcutRegistry.ts     # 快捷键注册表
    ├── useShortcut.ts          # 快捷键 Hook
    └── types.ts                # 快捷键类型

packages/core/src/lib/features/taste/
├── index.ts                    # 公共 API 导出
├── taste-schema.ts             # Taste 类型和验证
├── context-memory-db.ts        # 上下文记忆数据库
├── memory-graph.ts             # 记忆图
└── taste-loader.ts             # Taste 加载器

packages/core/src/lib/features/culture/
├── index.ts                    # 公共 API 导出
├── types.ts                    # Culture Detection 类型
├── services/
│   ├── CultureDetectionService.ts  # 品味检测服务
│   └── CultureSessionService.ts   # 会话管理服务
└── hooks/
    └── useCultureDetection.ts     # React Hook
```

## 4. 主线案例：小王的个性化 OriginOS

本单元沿用"小王开社区咖啡馆"案例：

1. 小王打开 OriginOS，界面用 `easings.standard` 缓动动画平滑过渡。
2. 小王滚动长列表时，`VirtualList` 只渲染可见项，保持 60fps。
3. 小王按 `Ctrl+K` 打开命令面板，`ShortcutRegistry` 响应快捷键。
4. 小王和 OriginOS 对话，系统通过 `CultureDetectionService` 分析小王的回答。
5. 系统发现小王偏好"简洁"和"可维护性"，生成 Taste Profile。
6. 小王再次使用时，系统根据 Taste Profile 推荐更合适的方案。

## 5. 关键概念速览

### 5.1 动画系统架构

```
React 组件
  ↓
useAnimation / useSpring / useTransition
  ↓
Web Animations API / requestAnimationFrame
  ↓
CSS Transform / Opacity 变化
```

### 5.2 系统服务架构

```
System Module
  ├── errors/       # ErrorBoundary, ErrorFallback, reportError
  ├── performance/  # LazyLoader, VirtualList, useMemoryCleanup
  └── shortcuts/    # ShortcutRegistry, useShortcut
```

### 5.3 Taste & Culture 架构

```
Culture Detection
  ├── CultureSessionService    # 管理对话会话
  ├── CultureDetectionService  # 分析对话，提取品味
  │   ├── 关键词提取（经验拓扑、品味标准、张力位置）
  │   └── 置信度计算
  └── Taste Profile          # 生成用户品味档案

Taste Memory
  ├── ContextMemoryDB        # 上下文记忆数据库
  ├── MemoryGraph            # 图结构记忆存储
  └── TasteLoader            # 加载和合并 Taste Profile
```

## 6. 与前后单元的衔接

**上游（单元五 G39–G46）：**
- 文档解析和 API 调用为 Taste 和 Culture 提供数据输入。
- 沙箱为技能系统提供安全的运行环境。

**下游（单元七 G61–G72）：**
- 技能系统使用 Taste Profile 个性化推荐。
- 用户配置和注册表管理 Taste 数据。

## 7. 阅读建议

按以下顺序阅读本单元：

1. 先读 G47–G48，理解动画缓动和时长。
2. 读 G49–G51，理解动画 Hooks。
3. 读 G52–G54，理解系统服务。
4. 读 G55–G57，理解 Taste 系统。
5. 读 G58–G59，理解 Culture Detection。
6. 最后做 G60 工作坊，画出完整调用链。

---

**准备好后，从 G47 开始。**
