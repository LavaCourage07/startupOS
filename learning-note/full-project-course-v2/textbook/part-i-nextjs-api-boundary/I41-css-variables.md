# I41：CSS 变量：动态样式的定义与使用

上一节课看了 Tailwind CSS。这节课看 CSS 变量如何定义和使用。

## 1. 文件用途

CSS 变量（Custom Properties）定义了 OriginOS 的动态样式，包括：

- 颜色变量
- 尺寸变量
- 主题切换

## 2. 核心实现

打开 `globals.css`：

```css
:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 214, 219, 220;
  --background-end-rgb: 255, 255, 255;
}
```

## 3. 核心逻辑

### 3.1 变量定义

```css
:root {
  --foreground-rgb: 0, 0, 0;
}
```

- `:root`：全局作用域。
- `--foreground-rgb`：变量名。
- `0, 0, 0`：变量值。

### 3.2 变量使用

```css
body {
  color: rgb(var(--foreground-rgb));
}
```

- `var(--foreground-rgb)`：引用变量。

### 3.3 动态修改

JavaScript 可以动态修改 CSS 变量：

```js
document.documentElement.style.setProperty('--foreground-rgb', '255, 0, 0');
```

## 4. 失败路径

### 4.1 变量未定义

如果变量未定义，`var()` 会返回空值。

### 4.2 变量名错误

如果变量名错误，`var()` 会返回空值。

## 5. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器访问 | 页面能渲染 | 样式一定正确 |
| 代码阅读 | 逻辑清晰 | 所有浏览器兼容 |

## 6. 小实验

不运行项目，回答：

1. CSS 变量如何定义？
2. CSS 变量如何使用？
3. JavaScript 如何修改 CSS 变量？

参考答案：

1. 在 `:root` 或任意选择器中定义。
2. 通过 `var()` 函数引用。
3. 通过 `setProperty()` 方法修改。

## 7. 章节收束

本节课看了 CSS 变量的实现：定义、使用、动态修改。CSS 变量是 OriginOS 动态样式的基础。

下一节课会看响应式设计如何实现。
