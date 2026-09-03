# I32：GET /api/skills/{skillName}/content：技能内容查询

前五个单元追踪了页面路由、会话管理、消息流式响应、项目级 Agent 生命周期、统计和摘要。这个单元转向 Skill 和 Interview 相关的 API。这节课先看技能内容查询。

## 1. 接口用途

技能内容查询接口用于获取技能的内容，如：

- 技能描述
- 技能参数
- 技能示例

这些信息用于前端展示技能详情。

## 2. Route Handler 的实现

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

## 3. 核心逻辑

### 3.1 获取技能名

```ts
const { skillName } = await params;
```

从 URL 路径参数获取技能名。

### 3.2 查询技能内容

```ts
const content = await getSkillContent(skillName);
```

`getSkillContent` 的实现属于 Part E/F，可能的逻辑：

1. 从技能目录读取技能定义文件。
2. 解析 frontmatter 和内容。
3. 返回技能内容。

### 3.3 404 处理

如果技能不存在，返回 404。

## 4. 失败路径

### 4.1 技能不存在

返回 404。这是最常见的错误。

### 4.2 技能内容为空

如果 `getSkillContent` 返回空，返回 404。

## 5. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| `curl` 调用 | 能返回技能内容 | Core Service 所有分支都正确 |
| `curl` 技能不存在 | 返回 404 | 所有错误分支都处理 |

## 6. 小实验

不运行项目，回答：

1. 为什么技能内容查询的路径是 `/api/skills/{name}/content`，而不是 `/api/skills/{name}`？
2. 如果技能不存在，返回什么状态码？
3. 技能内容查询和会话查询有什么本质区别？

参考答案：

1. 为了区分技能元数据查询和技能内容查询。`/api/skills/{name}` 可能返回元数据，`/api/skills/{name}/content` 返回内容。
2. 404。
3. 技能内容查询返回静态内容，会话查询返回动态数据。

## 7. 章节收束

本节课看了 `GET /api/skills/{skillName}/content` 的实现：获取技能名、查询技能内容、404 处理。技能内容查询是 OriginOS 的核心业务接口。

下一节课会看 Interview 页面。
