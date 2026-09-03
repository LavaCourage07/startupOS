# 单元总览与复盘六：Skill 与 Interview API（I32—I36）

前五个单元追踪了页面路由、会话管理、消息流式响应、项目级 Agent 生命周期、统计和摘要。这个单元转向 Skill 和 Interview 相关的 API。

## 0. 本页先读什么

如果只记住一句话，记住这一句：

> Skill 和 Interview API 是 OriginOS 的核心业务接口，连接用户操作和 Agent 能力。

## 1. 本单元覆盖的接口

| 接口 | 路径 | 作用 |
| --- | --- | --- |
| Skill 内容 | `GET /api/skills/{skillName}/content` | 获取技能内容 |
| Interview 页面 | `GET /interview` | 渲染访谈页面 |
| 测试 Interview | `GET /test-interview` | 测试访谈页面 |
| 测试窗口 | `GET /test-window` | 测试窗口页面 |

## 2. Skill 内容 API

### 2.1 Route Handler 的实现

打开 `app/api/skills/[skillName]/content/route.ts`：

```ts
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ skillName: string }> }
) {
  try {
    const { skillName } = await params;
    const content = await getSkillContent(skillName);

    if (!content) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Skill not found',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: content,
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    // ... 500 处理
  }
}
```

### 2.2 核心逻辑

1. **获取技能名**：从 URL 路径参数获取。
2. **查询技能内容**：`getSkillContent(skillName)`。
3. **404 处理**：如果技能不存在，返回 404。

## 3. Interview 页面

### 3.1 Route Handler 的实现

打开 `app/interview/page.tsx`：

```tsx
export default function InterviewPage() {
  return <ProjectInterview />;
}
```

### 3.2 核心逻辑

Interview 页面直接渲染 `ProjectInterview` 组件，没有复杂的逻辑。

## 4. 测试页面

### 4.1 测试 Interview

打开 `app/test-interview/page.tsx`：

```tsx
export default function TestInterviewPage() {
  return <InterviewWindow />;
}
```

### 4.2 测试窗口

打开 `app/test-window/page.tsx`：

```tsx
export default function TestWindowPage() {
  return <WindowTest />;
}
```

## 5. 五节课连成一条因果链

I32—I36 不是五个孤立文件介绍。它们按"从 Skill 到 Interview"的顺序推进。

| 课次 | 本课解决的判断问题 | 核心源码锚点 | 学完后的判断能力 |
| --- | --- | --- | --- |
| I32 | `GET /api/skills/{name}/content` 如何获取技能内容 | `api/skills/[skillName]/content/route.ts` | 能理解 Skill 内容查询的链路 |
| I33 | `GET /interview` 如何渲染访谈页面 | `app/interview/page.tsx` | 能理解 Interview 页面的入口 |
| I34 | `GET /test-interview` 如何测试访谈 | `app/test-interview/page.tsx` | 能理解测试 Interview 的入口 |
| I35 | `GET /test-window` 如何测试窗口 | `app/test-window/page.tsx` | 能理解测试窗口的入口 |
| I36 | 如何验证 Skill 和 Interview API | 复用上述文件 | 能根据现象定位问题 |

## 6. 源码覆盖台账

| 课次 | 已直接精读的生产源码 | 配对测试或验证入口 | 本单元只证明什么 |
| --- | --- | --- | --- |
| I32 | `api/skills/[skillName]/content/route.ts` | 无单元测试 | Skill 内容查询的链路 |
| I33 | `app/interview/page.tsx` | 无单元测试 | Interview 页面的入口 |
| I34 | `app/test-interview/page.tsx` | 无单元测试 | 测试 Interview 的入口 |
| I35 | `app/test-window/page.tsx` | 无单元测试 | 测试窗口的入口 |
| I36 | 不新增生产逻辑；复用上述文件 | 纸面推演 + 运行观察 | 把 Skill 和 Interview 知识转成可验证的排查能力 |

## 7. 异常排查

当小林说"Skill 找不到""Interview 页面空白"时，最稳的排查方式是先确认 URL，再确认组件。

```mermaid
flowchart TD
    A[Skill/Interview 异常] --> B{URL?}
    B -->|/api/skills/{name}/content| C[检查 skillName]
    B -->|/interview| D[检查 ProjectInterview 组件]
    B -->|/test-interview| E[检查 InterviewWindow 组件]
    B -->|/test-window| F[检查 WindowTest 组件]
```

排查口诀：

1. 先看 URL，确认走到哪个文件。
2. 再看组件是否正确渲染。
3. 最后检查组件内部逻辑。

## 8. 口头验收

学完 I32—I36 后，不看正文也应能回答：

1. `GET /api/skills/{name}/content` 返回什么？
2. `/interview` 和 `/test-interview` 有什么区别？
3. 如果 Skill 找不到，应该按什么顺序排查？

合格回答不要求背诵源码行号，但必须能说出调用顺序和责任边界。

## 9. 进入下一单元

I32—I36 建立的是 Skill 和 Interview API 的完整链路。下一组课程会继续追踪多 Agent 协作运行时的消息路由、Agent 内部的工具调用机制。

因此，本单元的结论可以压缩成一句话：

> Skill 和 Interview API 是 OriginOS 的核心业务接口，先确认 URL 和组件，再检查内部逻辑。
