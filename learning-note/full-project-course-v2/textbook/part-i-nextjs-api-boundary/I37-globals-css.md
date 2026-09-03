# I37：globals.css：全局样式的定义

前六个单元追踪了页面路由、会话管理、消息流式响应、项目级 Agent 生命周期、统计和摘要、Skill 和 Interview。这个单元转向全局样式和布局。这节课先看 `globals.css`。

## 1. 文件用途

`globals.css` 定义了 OriginOS 的全局样式，包括：

- Tailwind CSS 指令
- CSS 变量
- 全局背景

## 2. Tailwind CSS 指令

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 2.1 指令说明

| 指令 | 说明 |
| --- | --- |
| `@tailwind base` | 重置浏览器默认样式 |
| `@tailwind components` | 包含 Tailwind 的组件类 |
| `@tailwind utilities` | 包含 Tailwind 的工具类 |

## 3. CSS 变量

```css
:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 214, 219, 220;
  --background-end-rgb: 255, 255, 255;
}
```

### 3.1 变量说明

| 变量 | 说明 |
| --- | --- |
| `--foreground-rgb` | 前景色（文字颜色） |
| `--background-start-rgb` | 背景渐变起始色 |
| `--background-end-rgb` | 背景渐变结束色 |

## 4. 全局背景

```css
body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
    to bottom,
    rgb(var(--background-start-rgb)),
    rgb(var(--background-end-rgb))
  );
}
```

### 4.1 样式说明

| 样式 | 说明 |
| --- | --- |
| `color` | 文字颜色 |
| `background` | 背景渐变 |

## 5. 失败路径

### 5.1 Tailwind CSS 未安装

如果 Tailwind CSS 未安装，`@tailwind` 指令会报错。

### 5.2 CSS 变量未定义

如果 CSS 变量未定义，`rgb(var(--foreground-rgb))` 会失效。

## 6. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器访问 | 页面能渲染 | 样式一定正确 |
| 代码阅读 | 逻辑清晰 | 所有浏览器兼容 |

## 7. 小实验

不运行项目，回答：

1. `@tailwind base` 的作用是什么？
2. 如果 `--foreground-rgb` 未定义，会发生什么？
3. `globals.css` 和 `layout.tsx` 有什么区别？

参考答案：

1. 重置浏览器默认样式。
2. `rgb(var(--foreground-rgb))` 会失效，文字颜色可能为黑色。
3. `globals.css` 定义全局样式，`layout.tsx` 定义根布局。

## 8. 章节收束

本节课看了 `globals.css` 的实现：Tailwind CSS 指令、CSS 变量、全局背景。`globals.css` 是 OriginOS 的视觉基础。

下一节课会看 `layout.tsx`。
