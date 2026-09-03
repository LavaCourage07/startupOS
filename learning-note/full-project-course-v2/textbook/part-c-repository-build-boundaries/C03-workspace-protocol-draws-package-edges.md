# C03：`workspace:` 画的是包依赖边，不是目录所有权

## 从成员名单到依赖图

C02 只证明六个 package 被 pnpm 识别。它们并非自动互相可见。一个包要用另一个本地包，仍需在自己的 manifest 中声明依赖。OriginOS 使用 `workspace:` 协议表达“从当前 workspace 解析这个包”。

本章继续头脑风暴案例：Web 页面能够导入 `@originos/core/types`，不是因为 `web` 和 `core` 相邻，而是 Web manifest 声明了 Core，Core manifest 又通过 `exports` 公开了对应入口。

## 当前 package 依赖图

```mermaid
flowchart TD
    Web[@originos/web] --> Core[@originos/core]
    Web --> Adapter[@originos/pi-agent-adapter]
    Desktop[@originos/desktop] --> Adapter
    Core --> Adapter
    Adapter --> Tasks[@originos/pi-tasks]
    Service[@originos/service] --> Core
    Root[根 package] --> Adapter
```

每根箭头都对应一个 manifest 的 `dependencies` 字段，箭头从消费者指向被依赖者。图没有画第三方包，也没有声称 Service 已有生产入口。包存在与包被使用仍是两件事。

## 第一组源码：Web、Core 与 Desktop

[Web manifest 第 14—20 行](../../../../packages/web/package.json#L14) 声明 `@originos/core: workspace:*` 和 adapter。`workspace:*` 要求名称匹配本地包，但不要求本地版本等于某个固定值。

[Core manifest 第 7—10 行](../../../../packages/core/package.json#L7) 依赖 adapter； [Desktop manifest 第 37—50 行](../../../../packages/desktop/package.json#L37) 也直接依赖 adapter。于是 adapter 不是“Core 私有实现”，至少两个上游 package 都拥有直接依赖合同。

## 第二组源码：adapter 锁住 pi-tasks 版本

[Agent adapter manifest 第 40—57 行](../../../../packages/agent/package.json#L40) 使用：

```json
"@originos/pi-tasks": "workspace:0.2.0-originos.1"
```

这与 `workspace:*` 不同。它同时要求本地解析与版本匹配； [pi-tasks manifest 第 1—5 行](../../../../packages/pi-tasks/package.json#L1) 当前版本正是 `0.2.0-originos.1`。若只改 pi-tasks 的版本却不改 adapter 的范围，安装阶段就可能拒绝这条本地边。

## 第三组源码：一个“只有 manifest”的 Service 包

[Service manifest](../../../../packages/service/package.json#L1) 只声明名字、版本、private 和对 Core 的依赖，没有 `main`、`exports` 或 scripts。准确结论是：workspace 中存在一个 service package 边界，并声明可消费 Core；当前 manifest 本身没有给出可执行入口或公共导出。

不能由此说“Service 服务已经运行”，也不能因为文件很短就把它忽略。空边界可能是预留、迁移中状态或尚未接通的结构事实。

## manifest 中的四类字段承担不同责任

| 字段 | 回答的问题 | 当前例子 | 不负责 |
| --- | --- | --- | --- |
| `name/version` | 包是谁 | `@originos/core@0.1.0` | 代码是否已经被使用 |
| `dependencies` | 运行消费者声明谁 | Web → Core | 依赖内部 API 是否稳定 |
| `devDependencies` | 开发/构建工具是谁 | Desktop → Vitest/tsc | 最终包一定携带工具 |
| `main/exports/types` | 从哪里进入包 | Core `./types` | 任意内部文件都公开 |
| `scripts` | 可执行动作是什么 | Web `build` | 动作当前一定通过 |
| `private` | registry 发布保护 | 六个包均 private | 源码保密或运行隔离 |

用这张表读 manifest，可以避免把“包身份、依赖边、公开门、命令”一次性叫作配置。每个字段回答不同问题，也需要不同验证。

## 直接依赖、传递依赖与源码调用

Web 直接依赖 Core，Core 直接依赖 adapter，因此 adapter 也是 Web 的传递依赖；但 Web 又在自己的 manifest 直接声明 adapter。这条直接声明允许 Web 源码显式导入 adapter，而不依赖 Core 把它偶然带进来。

三层关系必须区分：

1. manifest 直接边：消费者承诺自己需要目标包；
2. 解析图传递边：安装器为了满足直接边带入更多包；
3. 源码调用边：某个 import/动态加载真的使用目标 API。

只搜索 manifest 可以画第 1 层，lockfile 能扩展第 2 层，源码 `rg` 才能观察第 3 层。C03 的图只承诺第 1 层，不冒充完整运行调用图。

## `workspace:*` 与普通 semver 的发布语义

在 workspace 内，`workspace:*` 强制解析本地同名 package，避免误从 registry 拿到另一个版本。若未来发布，pnpm 可以将 workspace 协议转换为合适版本范围；但当前所有相关包 `private: true`，本章不假设发布行为。

`workspace:0.2.0-originos.1` 更严格：本地目标版本必须匹配显式版本。它适合 adapter 与受控 fork 保持成对演进，也提高升级成本——两边 manifest、lockfile、runtime tests 都要同步。

## 包图与 AGENTS 层级图不是同一张图

package 图描述 Web/Core/Desktop/Agent 等物理包依赖；AGENTS 的 Layer 1-6 还描述同一 package 内的 app、components、services、features、storage 等逻辑层级。

例如 Web → Core 在 package 层是允许方向；Web component 是否直接穿透 Core feature 内部实现，则是 API 边界问题。package graph 没有环不等于 feature graph 没有违规。C15 会说明自动检查也没有完整覆盖所有层级。

## 反向读取：从 provider 找消费者

正向看 manifest 可知“Web 依赖谁”；做破坏性改动前还要反向搜索“谁依赖 Core”。最小审计步骤：

```text
读取 Core package name
→ 搜索所有 package.json 的 workspace specifier
→ 搜索源码中的 @originos/core import
→ 搜索跨包相对 core/src import
→ 搜索构建/打包复制 Core 的脚本与配置
```

这一步会发现 manifest 边之外的 Desktop 相对穿透和 builder 文件复制。只检查 `workspace:` 会漏掉这些真实消费者。

## 计算例：修改 Core package name

若把 `@originos/core` 改名为 `@originos/kernel`，至少发生：

1. Core manifest 身份变化；
2. Web/Service dependencies 的 key 必须变化；
3. Web/测试/源码 package import 必须变化；
4. TypeScript/Vitest aliases 可能需要变化；
5. lockfile importers 必须重算；
6. Desktop 的相对路径导入可能暂时不受名字影响，反而暴露平行通道；
7. 文档和打包验证需更新。

因此 package rename 不是改一行字符串。它是公共身份迁移，必须从 provider 反向走到所有消费者。

## 测试应怎样固定 package 合同

一个轻量合同测试可以读取所有 manifest，断言：workspace 依赖目标存在、显式版本匹配、每个 export 的目标文件存在。它仍不能证明目标文件可在 CommonJS/ESM/浏览器环境加载。

加载级测试还需要分别从 Web bundler、Node require、ESM import 或 Desktop 打包态调用公共入口。不同入口复用同一源码，不代表解析合同自动一致。

## 输入推演：Web 导入一个 Core 类型

以 Part B 中的导入为例：

```ts
import type { ProjectStatus } from '@originos/core/types';
```

解析所需条件依次是：

```text
Web 源码出现 package specifier
→ Web dependencies 声明 @originos/core
→ workspace 找到 name 为 @originos/core 的 manifest
→ Core exports 存在 ./types
→ 工具链将它映射到 src/types/index.ts
```

任何一步缺失都可能表现为“Cannot find module”，但修复位置不同。随手改成跨包相对路径可能绕过某个 package 合同，却制造更强耦合；C08 会精读这个公共入口。

## 失败与恢复放在同一张表

| 条件变化 | 失败阶段 | 观察证据 | 正确恢复方向 |
| --- | --- | --- | --- |
| filter 名写错 | package 选择 | pnpm 无匹配包 | 修根脚本或 package name |
| 漏写 `workspace:` 依赖 | 模块解析/安装 | consumer manifest 无声明 | 在真正消费者声明依赖 |
| 本地版本不匹配 | workspace 解析 | specifier 与 version 不同 | 同步版本合同 |
| Core 未 export 子路径 | import 解析 | manifest 有包却无 subpath | 增加公共 API 或改用已有入口 |
| 直接相对穿透 | 可能暂时编译 | import 绕过 package API | 回到公共导出，不把“能编译”当合规 |

## 验证证据与缺口

当前 `pnpm list -r --depth -1` 证明包名和版本可被读取；对所有 manifest 的 `workspace:` 搜索得到图中的七条边。它没有证明每条边都在生产源码中被调用，也没有证明没有动态加载或文件路径式的隐式耦合。

本章的 Given/When/Then 是：Given 六个已发现 package；When 搜索全部 manifest 的 workspace specifier；Then 可还原七条直接边，并验证 pi-tasks 显式版本与 provider version 相同。没有执行 install/build，所以解析与加载阶段仍属未验证。

## 源码实验室：同一个包名在提供者和消费者两侧怎样闭合

先读提供者身份，见 [Core manifest 第 1—13 行](../../../../packages/core/package.json#L1)：

```json
{
  "name": "@originos/core",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

`name` 是依赖图中的节点身份；`private` 阻止意外发布；`exports` 决定消费者获准使用的公开路径。它们不决定谁已经依赖 Core。

消费者证据位于 [Web manifest 第 14—20 行](../../../../packages/web/package.json#L14)：

```json
"dependencies": {
  "@originos/core": "workspace:*",
  "@originos/pi-agent-adapter": "workspace:*",
  "@anthropic-ai/sandbox-runtime": "^0.0.51"
}
```

`workspace:*` 要求安装器从当前 workspace 连接本地包，而普通 semver 允许从 registry 解析。它只建立包级依赖边；实际源码是否导入、导入哪个 subpath，仍需搜索 import 调用点。

第三个窗口展示一条继续向下的边，见 [Agent manifest 第 40—51 行](../../../../packages/agent/package.json#L40)：

```json
"@earendil-works/pi-agent-core": "0.80.10",
"@earendil-works/pi-coding-agent": "0.80.10",
"@originos/pi-tasks": "workspace:0.2.0-originos.1"
```

这里同时要求 workspace 包和版本匹配。若本地 pi-tasks 版本变化而消费者没有同步，安装阶段就可能拒绝连接；这比运行时才发现 API 不兼容更早暴露问题。

### 一条真实输入怎样移动

输入 `import type { Project } from '@originos/core/types'` 时，包管理器先用 Web dependency 确认 Core 是合法依赖，再由 Core exports 将 `/types` 映射到 `src/types/index.ts`，最后由 TypeScript/Next 读取目标。缺 dependency 修消费者 manifest，缺 export 修提供者公开面，目标文件缺导出则修 Core index。

### 测试缺口

当前没有一项测试同时验证“所有 `workspace:` 声明都有唯一提供者、版本约束匹配、公开 subpath 存在”。可靠的合同测试应枚举 workspace manifest，分别断言 name 唯一、dependency 可解析和 export 目标存在。

## 小实验与口头验收

1. 把图中每根边还原为“哪个 manifest 的哪一项”。
2. 预测把 pi-tasks 版本改为 `0.2.1` 而不改 adapter specifier 的结果。
3. 解释 `private: true`、`workspace:*`、`exports` 分别解决什么问题。
4. 从一次 `Cannot find module '@originos/core/types'` 出发，按 manifest、workspace、exports 的顺序排查。

### 实验参考推演

第1题应逐条指回消费者 manifest，而不是只重画箭头。Web 有两条、Core 一条、Desktop 一条、Adapter 一条、Service 一条、根一条。

第2题会让 adapter 的 `workspace:0.2.0-originos.1` 与 pi-tasks provider version 不匹配，优先在 workspace/安装解析阶段暴露。

第3题：private 防 registry 误发布；workspace 选择本地包/版本合同；exports 约束公共子路径。三者没有替代关系。

第4题合格顺序是 consumer dependency → workspace provider身份 → provider exports → 工具alias/环境；把 import 改成相对路径不属于优先修复动作。

## 源码阅读顺序

1. 从 Web manifest 找到 Core/adapter 两条边。
2. 从 Core/Desktop 继续找到共享 adapter。
3. 在 adapter 找到精确 pi-tasks 边，并对照 provider version。
4. 最后读 Service 的最小 manifest，记录“边存在、入口未声明”。
5. 反向 `rg` package specifier 与 `core/src` 相对穿透，补 manifest 图看不见的消费者。

第三方 dependencies 暂时只作为节点外部输入，不在本课逐个展开；lockfile在 C04 负责传递图。

## 迁移验收：让 Service 获得可运行入口

不能只新增 `src/index.ts`。需要决定源码/构建产物消费方式，设置 main/types/exports，增加 build/test/typecheck scripts，验证对 Core 的依赖方向，并找到真实上游调用者。若没有生产调用者，应写成“入口已准备但未接入”，而非“Service 已运行”。

这个迁移题要求同时回答“谁调用它”和“它调用谁”，防止把 package 边界文件存在误写成产品链路完成。

下一课继续区分两份常被混淆的事实：manifest 声明“想要哪个版本”，lockfile 记录“这次解析到了什么”。
