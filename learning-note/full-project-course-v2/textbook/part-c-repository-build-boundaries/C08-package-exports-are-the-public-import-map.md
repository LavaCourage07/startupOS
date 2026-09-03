# C08：包的 `exports` 是公共门牌，不是整个目录的参观许可

## 为什么 `@originos/core/types` 能用，任意深层路径却未必能用

Part B 的 Web 页面从 `@originos/core/types` 导入类型，也从 `@originos/core/lib/integrations/...` 导入功能。包名只把解析带到 Core manifest；具体子路径能否进入，由 `exports` 继续约束。

本章解决公共入口、TypeScript alias 与跨包相对路径的差异。业务 API 设计留给 D/G，这里只讲工程解析与边界后果。

## 三类“捷径”不能混用

| 写法 | 谁解释 | 责任 | 风险 |
| --- | --- | --- | --- |
| `@originos/core/types` | package resolver + `exports` | 跨包公共入口 | 出口过多会扩大兼容面 |
| `@/components/...` | 当前工具的 alias 配置 | 包内源码便捷路径 | tsc、Vitest、Webpack 必须各自一致 |
| `../../../../core/src/...` | 文件系统相对解析 | 直接穿透实现 | 绕过 package exports，目录移动敏感 |

## 公共解析链

```mermaid
flowchart LR
    A[Web import @originos/core/types] --> B[Web dependencies]
    B --> C[Core package.json]
    C -->|exports ./types| D[core/src/types/index.ts]
    D --> E[TypeScript 或 bundler 消费]
```

dependencies 回答“能否依赖这个包”，exports 回答“包允许从哪个门进入”，目标文件才提供符号。任一箭头失败，都可能显示模块无法解析。

## 第一段源码：Core 的出口很多，但不是无限

[Core manifest 第 12—79 行](../../../../packages/core/package.json#L12) 从 `.`、`./types`、storage、features、pi-agent integrations 到 modules 声明大量子路径。通配符如 `./lib/features/*` 将一段请求路径映射到对应 `index.ts`；更具体的规则则公开某些服务文件。

需要看清两个边界：

1. `exports` 中存在的路径是公共解析合同，但不代表其内部设计已经稳定。
2. 没有匹配规则的文件即使真实存在，也不应默认可从 package specifier 导入。

过宽 exports 能解决短期解析，却让更多内部文件成为上游依赖，后续重构成本更高。

## 精确规则与通配符的匹配责任

Core exports 同时出现：

```json
{
  "./types": "./src/types/index.ts",
  "./lib/features/*": "./src/lib/features/*/index.ts",
  "./lib/integrations/*/*": "./src/lib/integrations/*/*.ts"
}
```

精确规则为一个稳定名字绑定一个目标；单星号规则把请求中的一段代入目标；双层通配组合公开更多内部表面。读者需要用具体请求替换星号，而不是凭肉眼说“整个目录都能导入”。

例如 `@originos/core/lib/features/project` 预期匹配 `./lib/features/*`，目标是 project 的 `index.ts`；`@originos/core/lib/features/project/types` 则由更具体的 `./lib/features/*/types` 匹配。若目标文件不存在，规则仍可写在 JSON 里，实际解析才失败。

## 条件 exports 与简单字符串 exports

Core 将子路径直接映射为 TS 字符串，依赖 Next/TypeScript 等工具理解源码。Adapter 则为每个入口提供 `types`、`require`、`default` 条件；pi-tasks 提供 `types`、`import`、`default`。

这三种 package 面向不同消费者：

| 包 | 运行目标 | exports 目标 | 前置条件 |
| --- | --- | --- | --- |
| Core | workspace 源码消费 | `.ts`/`index.ts` | bundler/TS 能转译 |
| Adapter | Node CommonJS | `.js` + `.d.ts` | build-runtime 先产出 |
| pi-tasks | Node ESM | `.js` + `.d.ts` | ESM loader/Node 版本 |

因此“统一所有 exports 写法”不是无条件优化。要先确定运行消费者。

## 类型导入也会产生解析责任

`import type` 在最终 JS 中可被移除，但 TypeScript 检查阶段仍要解析 package 和目标声明。依赖只用于类型也不能凭空省略 package 合同；否则消费者在干净安装中可能无法检查。

同时，类型解析通过不代表运行 export 存在。Adapter 的 `.d.ts` 与 `.js` 是两份文件，必须通过合同测试防漂移。

## alias 的生效范围必须逐工具列出

| alias | TypeScript | Next/Webpack | Web Vitest | Core Vitest | Desktop tsc |
| --- | --- | --- | --- | --- | --- |
| `@/*` | 各 package tsconfig | Next读取 Web配置 | 指 Web src | 指 Core src | 未声明通用 `@` |
| `@originos/core` | package resolution/paths | transpilePackages | 直接 alias Core src | 按 Core本身 | paths 指 Core src |
| neural-nexus | Web tsconfig | Next显式 alias | 未在 Web Vitest列出 | 不适用 | 不适用 |

此表揭示潜在空洞：Web TypeScript/Next 能解析 neural-nexus alias，不代表 Web Vitest 自动能解析。具体测试可能没有导入它，或由其他 resolver补齐；没有运行证据不能写成一致。

## `as unknown as` 与 exports 无关

源码中偶尔用类型断言适配对象形状。它不会改变模块解析，也不会把未 export 文件公开。解析失败发生在代码执行/类型分析之前，不能通过类型断言修复。

## 公共 API 的所有权成本

一旦 Web/Desktop 多处从某个 Core 子路径导入，那个路径就形成事实公共面：改名需迁移消费者、测试、打包脚本与文档。`index.ts` barrel 可以隐藏内部文件位置，却也可能产生过度导出或循环。

审核一个新 export 前，应回答：

1. 哪个上层 consumer 需要它？
2. 能否从现有 feature/index 公共入口导出？
3. 它是否暴露内部存储/环境细节？
4. 类型与运行实现是否都可被目标环境消费？
5. 有哪个合同测试固定入口？

## 正向追踪：`@originos/core/lib/utils`

Web 组件导入该路径 → Web manifest 声明 Core → Core exports 精确映射 `./lib/utils` 到 `src/lib/utils.ts` → Next transpilePackages 转换 TS → 根据 server/client 图打包。

如果 `utils.ts` 内部导入 `node:fs`，exports 解析仍可能成功，浏览器 bundle 才在下一边界失败。公共门能找到房间，不保证房间内容适合所有访客。

## 反向迁移：收窄一个过宽 export

先搜索 package specifier consumers，再搜索 alias/相对穿透；新增稳定公共入口并迁移调用者；为旧入口保留过渡或在同一版本明确破坏；运行各消费环境测试；最后删除旧规则。只删 manifest 一行会让所有消费者同时在解析阶段失败，难以区分业务回归。

## 合同测试设计

- 静态：遍历 exports，验证目标 glob/文件存在。
- TypeScript：fixture 从每个公共入口 import type。
- Node：对 adapter/CommonJS 入口 require。
- ESM：对 pi-tasks import。
- Next：最小 server/client bundle 验证 Core 入口环境兼容。

四层测试分别固定门牌、类型、运行模块和框架环境，不能只保留第一层。

## 第二段源码：Web 与测试各有 alias 世界

[Web tsconfig 第 7—14 行](../../../../packages/web/tsconfig.json#L7) 把 `@/*` 指向 Web `src`； [Web Vitest 配置第 10—15 行](../../../../packages/web/vitest.config.ts#L10) 又为测试显式设置 `@` 与 `@originos/core`。 [Next 配置第 30—36 行](../../../../packages/web/next.config.mjs#L30) 再为 neural-nexus 模块配置 Webpack alias。

这三份配置服务不同工具。TypeScript 能定位别名，不等于 Vitest 或 Webpack 自动读取相同映射；仓库正是通过重复声明维持多个消费者的一致性。重复也带来漂移风险。

## 第三段源码：Desktop 仍存在相对穿透

Desktop tsconfig 为 `@originos/core` 设置 alias，但当前 Desktop main 服务中仍有大量 `../../../../core/src/...` 导入。源码事实是：Desktop 直接消费 Core 源码内部路径；这比 AGENTS.md 推荐的“通过 Core 公共 API”边界更紧耦合。

不能因为这些 import 当前可编译就写成最佳架构，也不能在教材中偷偷把现状理想化。正确判断是：公共入口与直接穿透并存；后者需要在未来迁移时逐个评估，而非一键替换。

## 输入推演：移动一个 Core 文件

假设把 `core/src/lib/integrations/pi-agent/stream-dedupe.ts` 移到新目录：

- 通过稳定 export 导入的调用者只需保持 export 映射，源码路径可以变化；
- 直接相对导入者会立即断裂；
- Vitest alias 若指向整个 Core src，仍可能解析其他路径，却不会自动修复具体文件名；
- 旧 dist 中同名 JS 可能让部分运行路径暂时看似正常。

这就是公共门牌的价值：隔离“消费者写法”与“实现摆放”。

## 失败诊断：编辑器能跳转，测试却报模块不存在

证据顺序：

1. 查看 import 属于 package specifier、alias 还是相对路径。
2. 若是 package specifier，查 consumer dependencies 与 provider exports。
3. 若是 alias，分别查 tsconfig、Vitest 和 Next/Webpack 配置。
4. 比较测试 cwd 与使用的 config 文件。
5. 清除“编辑器语言服务缓存”这一干扰后再验证命令。

## 测试证据与缺口

C16 会精读测试 alias。本章通过 manifest 与真实 import 搜索证明多种路径并存，没有执行覆盖全部 exports 的合同测试，因此不能保证每个通配符目标都存在或能被所有工具解析。

Given/When/Then 可写成：Given Core 当前 exports 与 consumer fixtures；When 分别在 Web bundler、Desktop Node 与 TypeScript 中解析；Then 只有声明入口成功，未声明内部入口失败，并且类型/运行符号一致。当前仓库尚未在本章提供这份全出口矩阵证据。

## 源码实验室：同一 import 在三套解析器中的逐层判定

Core manifest 先定义公共入口，见 [packages/core/package.json 第 12—25 行](../../../../packages/core/package.json#L12)：

```json
"exports": {
  ".": "./src/index.ts",
  "./lib/storage": "./src/lib/storage/index.ts",
  "./lib/storage/*": "./src/lib/storage/*.ts",
  "./lib/paths": "./src/lib/paths.ts",
  "./lib/utils": "./src/lib/utils.ts",
  "./types": "./src/types/index.ts",
  "./lib/features/*": "./src/lib/features/*/index.ts"
}
```

精确键优先回答固定 subpath，通配符则把星号代入目标。`@originos/core/lib/storage` 与 `@originos/core/lib/storage/json-store` 会走不同规则。目标路径存在仍不保证其内部导出所需符号；exports 只完成入口映射。

Web TypeScript 还有本包私有 alias，见 [Web tsconfig 第 7—14 行](../../../../packages/web/tsconfig.json#L7)：

```json
"baseUrl": ".",
"paths": {
  "@/*": ["./src/*"],
  "@neural-nexus/neural-channel": ["./src/modules/neural-channel/src"],
  "@neural-nexus/view-manager": ["./src/modules/view-manager/src"]
}
```

这里没有覆盖 `@originos/core/*`，因此 Core import 仍应经过 package dependency/exports。`@/*` 只属于 Web 类型世界，不能复制到 Core 后期待相同含义。

测试解析器再单独声明路径，见 [Web Vitest 配置第 10—15 行](../../../../packages/web/vitest.config.ts#L10)：

```ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@originos/core': path.resolve(__dirname, '../core/src'),
  },
},
```

Vitest 把整个 `@originos/core` 前缀直接导向 Core src，可能绕过 manifest 对精确 subpath 的限制。因此测试能 import 只能证明测试 alias 世界可解析，不能单独证明发布消费者遵守 exports。

### 故障反推

出现“编辑器可跳转、Vitest 报错”时，先识别编辑器使用的 tsconfig，再识别 Vitest 配置与 cwd，最后查 package exports。若只有 Vitest alias 缺失，应修测试配置或改用公共入口；若生产入口本就未导出，则不能靠测试 alias 掩盖合同缺口。

### 合同测试建议

为每个公开 subpath 分别执行 Node/TypeScript 解析和 Vitest import，并明确记录哪项使用源码 alias。只有实际发布形态测试经过 package exports，才可证明消费者合同。

## 小实验与口头验收

1. 把 `@originos/core/types` 的每一步解析写出来。
2. 判断 `@/foo` 在 Core 与 Web 中是否必然指同一目录，并说明原因。
3. 给“编辑器可跳转、Vitest 失败”设计最短排查顺序。
4. 解释为什么 `exports` 越多不一定越好。

### 实验参考推演

第1题必须包含consumer dependency、workspace provider、exports目标和工具转译四步；漏exports就没有公共子路径。

第2题不必然相同。alias属于配置局部：Web指Web src，Core测试指Core src，Desktop未声明通用`@`。

第3题先记录测试config/cwd，再对比tsconfig/Next alias；不要改生产import来迁就错误测试世界。

第4题每个出口都扩大兼容面、消费者数量和重构成本；公共入口应按稳定职责设计。

## 源码阅读顺序

1. 从真实consumer import抄完整specifier。
2. 查consumer manifest是否声明provider。
3. 在provider exports找最具体匹配规则并替换通配符。
4. 确认目标文件/符号存在，再查工具是否能转译模块格式。
5. 反向搜索同入口所有消费者与相对穿透。

## 迁移验收：把Desktop相对穿透改成公共API

按职责从Core feature/module index导出，避免为每个内部文件新增深层出口；逐个迁移Desktop import；保持TypeScript emit路径和worker动态加载可用；运行Core合同、Desktop compile/Node tests和打包require验证。若某内部类型不适合公开，应提取下层共享合同，而非把整个实现目录暴露。

下一课进入 Next：同一 Web package 还会同时生成服务端与浏览器代码，哪些模块能进入哪一边由 `next.config.mjs` 继续决定。
