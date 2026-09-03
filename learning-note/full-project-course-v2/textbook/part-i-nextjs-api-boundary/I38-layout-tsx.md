# I38：layout.tsx：根布局的定义

上一节课看了 `globals.css`。这节课看 `layout.tsx`。

## 1. 文件用途

`layout.tsx` 定义了 OriginOS 的根布局，包括：

- HTML 结构
- Body 结构
- 子组件渲染

## 2. 核心实现

打开 `app/layout.tsx`：

```tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

## 3. 核心逻辑

### 3.1 HTML 结构

```tsx
<html lang="en">
```

- `lang="en"`：设置语言为英文。

### 3.2 Body 结构

```tsx
<body>{children}</body>
```

- `children`：子组件，由 Next.js 自动传入。

## 4. 与 page.tsx 的区别

| 维度 | layout.tsx | page.tsx |
| --- | --- | --- |
| 作用 | 根布局 | 页面内容 |
| 渲染次数 | 一次 | 每次导航 |
| 状态保持 | 是 | 否 |
| 典型用途 | 全局导航、主题 | 页面内容 |

## 5. 失败路径

### 5.1 子组件加载失败

如果 `children` 加载失败，页面会显示空白或错误。

### 5.2 HTML 结构错误

如果 HTML 结构错误，可能导致 SEO 问题或 accessibility 问题。

## 6. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器访问 | 页面能渲染 | 布局一定正确 |
| 代码阅读 | 逻辑清晰 | 所有浏览器兼容 |

## 7. 小实验

不运行项目，回答：

1. `layout.tsx` 和 `page.tsx` 有什么区别？
2. 如果 `layout.tsx` 中没有 `{children}`，会发生什么？
3. `lang="en"` 的作用是什么？

参考答案：

1. `layout.tsx` 定义根布局，`page.tsx` 定义页面内容。
2. 子组件无法渲染，页面显示空白。
3. 设置语言为英文，影响 SEO 和 accessibility。

## 8. 章节收束

本节课看了 `layout.tsx` 的实现：HTML 结构、Body 结构、子组件渲染。`layout.tsx` 是 OriginOS 的根布局。

下一节课会看 `page.tsx`。
