# I36：综合工作坊：Skill 与 Interview 排查地图

前四节课（I32–I35）分别看了技能内容查询、Interview 页面、测试 Interview 页面、测试窗口页面。它们若只分别记住，仍不足以解释真实系统。一个合格的理解应当能够回答：当小林说"Skill 找不到""Interview 页面空白""测试窗口打不开"时，应该按什么顺序排查。

## 1. 实验边界与预期成果

本实验不依赖真实模型或 LLM 服务。它能够验证 Skill 和 Interview API 的局部事实，却不能证明 Core Service 内部实现、Agent 运行时行为或前端组件逻辑都正确。

完成本课后，应能形成一份简短的"Skill 与 Interview 排查地图"。

## 2. 总体认知图

```mermaid
flowchart TD
    A[Skill/Interview 异常] --> B{URL?}
    B -->|/api/skills/{name}/content| C[检查 skillName]
    B -->|/interview| D[检查 ProjectInterview 组件]
    B -->|/test-interview| E[检查 InterviewWindow 组件]
    B -->|/test-window| F[检查 WindowTest 组件]
```

## 3. 核心区分

### 3.1 Skill 内容查询 vs Interview 页面

| 维度 | Skill 内容查询 | Interview 页面 |
| --- | --- | --- |
| 路径 | `/api/skills/{name}/content` | `/interview` |
| 类型 | API | 页面 |
| 用途 | 获取技能内容 | 项目访谈 |
| 返回 | JSON | HTML |

### 3.2 常见错误

| 错误 | 原因 | 排查 |
| --- | --- | --- |
| 404 | Skill 不存在 | 检查 skillName |
| 空白 | 组件加载失败 | 检查组件实现 |
| 错误 | 数据加载失败 | 检查数据来源 |

## 4. 排查口诀

1. 先看 URL，确认走到哪个文件。
2. 再看组件是否正确渲染。
3. 最后检查组件内部逻辑。

## 5. 综合实验

### 场景 A：Skill 找不到

```text
GET /api/skills/unknown/content
```

合格推演：
- 原因：Skill `unknown` 不存在。
- 排查：检查 skillName 是否正确。

### 场景 B：Interview 页面空白

```text
GET /interview
```

合格推演：
- 可能原因 1：`ProjectInterview` 组件加载失败。
- 可能原因 2：项目数据加载失败。
- 排查：
  1. 检查 `ProjectInterview` 组件实现。
  2. 检查项目数据来源。

## 6. 口头验收

学完 I32—I36 后，不看正文也应能回答：

1. `GET /api/skills/{name}/content` 返回什么？
2. `/interview` 和 `/test-interview` 有什么区别？
3. 如果 Skill 找不到，应该按什么顺序排查？

## 7. I32—I36 单元结论

Skill 和 Interview API 是 OriginOS 的核心业务接口。先确认 URL 和组件，再检查内部逻辑。

因此，本单元可以压缩成一句话：

> Skill 和 Interview API 是 OriginOS 的核心业务接口，先确认 URL 和组件，再检查内部逻辑。
