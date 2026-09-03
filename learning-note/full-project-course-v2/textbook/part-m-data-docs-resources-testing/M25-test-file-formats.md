# M25 测试文件格式如何阅读——从 `.test.ts` 到测试用例

小林打开一个测试文件，看到 `describe`、`it`、`expect` 等关键字。她想知道测试文件的结构是怎样的、如何阅读测试用例、以及如何判断测试的覆盖范围。

本课解决一个理解问题：当你面对 OriginOS 的测试文件时，怎样理解测试文件的结构、阅读测试用例、以及判断测试的覆盖范围。

## 场景：从"测试代码"到"测试用例"

### 1.1 测试文件的结构

OriginOS 的测试文件使用 Vitest 框架，结构如下：

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './myFunction';

describe('myFunction', () => {
  it('should return correct result for valid input', () => {
    // Arrange
    const input = 'valid';
    
    // Act
    const result = myFunction(input);
    
    // Assert
    expect(result).toBe('expected');
  });
  
  it('should throw error for invalid input', () => {
    // Arrange
    const input = 'invalid';
    
    // Act & Assert
    expect(() => myFunction(input)).toThrow();
  });
});
```

### 1.2 测试文件的关键元素

| 元素 | 作用 | 示例 |
| --- | --- | --- |
| `describe` | 定义测试套件 | `describe('myFunction', () => {})` |
| `it` | 定义测试用例 | `it('should return correct', () => {})` |
| `expect` | 断言 | `expect(result).toBe('expected')` |
| `beforeEach` | 每个测试用例前的准备 | `beforeEach(() => {})` |
| `afterEach` | 每个测试用例后的清理 | `afterEach(() => {})` |

## 2. 测试用例的结构

### 2.1 AAA 模式

测试用例遵循 AAA（Arrange-Act-Assert）模式：

```typescript
it('should return correct result for valid input', () => {
  // Arrange: 准备输入数据
  const input = 'valid';
  
  // Act: 执行被测函数
  const result = myFunction(input);
  
  // Assert: 验证结果
  expect(result).toBe('expected');
});
```

| 阶段 | 责任 | 示例 |
| --- | --- | --- |
| Arrange | 准备输入数据和依赖 | `const input = 'valid'` |
| Act | 执行被测函数 | `const result = myFunction(input)` |
| Assert | 验证结果是否符合预期 | `expect(result).toBe('expected')` |

### 2.2 测试用例的命名

测试用例的命名应该清晰描述测试的场景：

| 好的命名 | 不好的命名 |
| --- | --- |
| `should return correct result for valid input` | `test1` |
| `should throw error when input is null` | `test error` |
| `should update user name successfully` | `update test` |

**关键理解**：好的测试用例命名应该描述"在什么条件下，发生了什么行为，产生了什么结果"。

## 3. 断言的类型

### 3.1 常用断言

| 断言 | 用途 | 示例 |
| --- | --- | --- |
| `toBe` | 严格相等 | `expect(result).toBe('expected')` |
| `toEqual` | 深度相等 | `expect(result).toEqual({a: 1})` |
| `toBeTruthy` | 真值 | `expect(result).toBeTruthy()` |
| `toBeFalsy` | 假值 | `expect(result).toBeFalsy()` |
| `toThrow` | 抛出异常 | `expect(() => fn()).toThrow()` |
| `toHaveLength` | 长度 | `expect(array).toHaveLength(3)` |

### 3.2 异步测试

```typescript
it('should fetch data successfully', async () => {
  // Arrange
  const id = '123';
  
  // Act
  const result = await fetchData(id);
  
  // Assert
  expect(result).toEqual({ id: '123', name: 'Test' });
});
```

**关键理解**：异步测试使用 `async/await`，确保测试等待异步操作完成。

## 4. 文档覆盖台账

| 本课直接精读的内容 | 精读范围 | 配对验证 | 本课只证明什么 |
| --- | --- | --- | --- |
| 测试文件结构 | 示例代码 | — | 测试文件的基本结构 |
| AAA 模式 | 概念描述 | — | 测试用例的组织方式 |
| 断言类型 | 概念描述 | — | 常用断言的用法 |

本课没有精读的内容也要明说：

- 具体的测试代码未精读
- 测试配置未精读
- 测试覆盖率分析未涉及

## 5. 练习：测试用例阅读

### 任务 A：分析测试用例

已知信息：

```typescript
it('should return error for invalid input', () => {
  const input = null;
  expect(() => myFunction(input)).toThrow();
});
```

问题：这个测试用例测试了什么？遵循 AAA 模式吗？

### 任务 B：编写测试用例

已知信息：需要测试一个加法函数 `add(a, b)`。

问题：应该编写哪些测试用例？

### 参考答案

**任务 A：**

| 分析 | 说明 |
| --- | --- |
| 测试内容 | 测试 `myFunction` 在输入为 `null` 时抛出异常 |
| AAA 模式 | 部分遵循——缺少 Arrange 阶段（但可以接受） |
| 改进 | 可以添加 Arrange 阶段，明确输入和预期 |

**任务 B：**

```typescript
describe('add', () => {
  it('should return correct sum for positive numbers', () => {
    expect(add(1, 2)).toBe(3);
  });
  
  it('should return correct sum for negative numbers', () => {
    expect(add(-1, -2)).toBe(-3);
  });
  
  it('should return zero for zero inputs', () => {
    expect(add(0, 0)).toBe(0);
  });
});
```

## 6. 口头验收

学完本课后，不看正文也应能回答下面五个问题：

1. 测试文件的结构是怎样的？关键元素有哪些？
2. AAA 模式是什么？每个阶段的责任是什么？
3. 常用的断言有哪些？各有什么用途？
4. 异步测试应该如何编写？
5. 当你需要阅读或编写测试用例时，应该注意什么？

合格回答不要求背诵每个断言的具体语法，但必须能说清测试文件的结构、AAA 模式、以及断言的选择。能说清"测试用例测试了什么"比只说清"测试代码怎么写"更重要。
