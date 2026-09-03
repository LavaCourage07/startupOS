# C14：Agent adapter 与 pi-tasks 是可加载运行包，不是 Core 的普通源码目录

## 同在 monorepo，为什么 adapter 要先 build

Desktop `dev` 与 `build:app` 都先执行 `@originos/pi-agent-adapter build`。Core manifest 则直接把 exports 指向 TypeScript 源码。差异来自消费者：adapter 需要以 Node/CommonJS 可加载的 JavaScript 形态连接外部 pi runtime，并在打包时复制入口文件。

本章只研究两个 package manifest 的运行合同；adapter 内部加载器与任务实现留给 Part K/L。

## 运行包链

```mermaid
flowchart LR
    C[Core 或 Desktop] -->|require/import package| A[@originos/pi-agent-adapter]
    A -->|exports 指向 JS| J[index.js ai.js goal.js 等]
    A -->|workspace 固定版本| T[@originos/pi-tasks]
    T -->|ESM exports| TS[index.js 与 src JS]
    B[build-runtime.js] -->|生成/准备| J
```

adapter 的公共门牌指向 JS 与 `.d.ts`；build-runtime 是前置生产者。pi-tasks 则声明 `type: module`，使用 `import` 条件。两者的模块系统并不相同。

## 第一段源码：adapter 的入口合同

[Agent manifest 第 1—38 行](../../../../packages/agent/package.json#L1) 声明：

- package 名 `@originos/pi-agent-adapter`；
- `main` 为 `./index.js`、`types` 为 `./index.d.ts`；
- `build` 与 `prepare` 都运行 `build-runtime.js`；
- exports 为根、`./ai`、`./coding-agent`、`./goal`、`./task-runtime` 提供 require/default 与 types。

这意味着上游导入 `@originos/pi-agent-adapter/ai` 时，Node 查的是 `ai.js`，TypeScript 类型系统查的是 `ai.d.ts`。若二者签名漂移，编辑器可以认为调用合法，运行时仍可能失败。

## 第二段源码：测试命令不只跑单测

[Agent manifest 第 7—11 行](../../../../packages/agent/package.json#L7) 的 `test` 先运行 `scripts/verify-runtime.js`，再用 Node test runner 执行 audit、runtime 与 integration tests。它与 Web/Core 的 Vitest 不是同一测试框架。

因此根 `pnpm test` 只过滤 Web 时，不会自动获得 adapter 的运行时验证证据。

## 第三段源码：pi-tasks 使用 ESM 与受控公开面

[pi-tasks manifest 第 1—24 行](../../../../packages/pi-tasks/package.json#L1) 设置 `type: module`，exports 使用 `import` 条件，公开根、contracts 与 store。 [第 26—43 行](../../../../packages/pi-tasks/package.json#L26) 又用 `files` 限制可发布内容，并提供 Node test、JavaScript typecheck 与 verify。

它当前 `private: true`，`files` 仍有价值：即使不发布 registry，这个列表表达运行分发边界，也可以被打包/审计工具参考。`pi.extensions` 指向 `index.js`，说明入口还承担 pi extension 装载角色。

## 为什么 adapter 不直接转发上游 package

adapter固定一组上游 pi packages版本，并暴露 OriginOS需要的入口。这个边界可以承担：

- 隔离上游包名/导出变化；
- 应用仓库 patch；
- 提供稳定 `.d.ts`；
- 组装 pi-tasks/goal扩展；
- 为 CommonJS消费者适配 ESM/动态加载。

这些是 package角色推断；每一项具体是否在 build-runtime实现，需要读对应源码。manifest只能证明版本与出口，不能证明所有适配逻辑已实现。

## 版本 `0.80.10` 为什么重复出现

adapter自身版本与三项 Earendil pi package均固定为 `0.80.10`，根 patchedDependencies也对这个精确版本打补丁。升级必须作为一个兼容集合处理：

```text
adapter version/实现
↔ 上游 pi-agent-core/pi-ai/pi-coding-agent/pi-tui
↔ 根 patches
↔ lockfile patched snapshot
↔ adapter声明文件与runtime tests
↔ Desktop builder复制清单
```

只把 dependency改为 `0.81` 会让旧patch无法应用或旧wrapper引用失效。

## CommonJS package怎样桥接 ESM依赖

Adapter exports提供 `require`，自身入口为 `.js` 且未声明 `type: module`，默认按CommonJS解释；pi-tasks声明ESM。CommonJS不能总是同步 `require()` ESM，需要动态 import或构建桥接。

manifest中存在 `load-runtime.js` 提示有加载边界，但本章没有读实现，因此准确表述是“adapter负责提供CommonJS可消费入口，并依赖一个ESM pi-tasks包；具体桥接由runtime build/loader实现，需后续验证”。

## `prepare` 的生命周期副作用

pnpm安装 workspace时可能运行 package `prepare`，adapter将它指向 `build-runtime.js`。这意味着安装不只是复制依赖，还可能生成/刷新adapter入口。

若 allowBuilds/生命周期策略阻止 prepare，workspace成员仍能被列出，但 JS入口可能陈旧或缺失。诊断“包存在但main找不到”要检查生命周期日志，而不是只查lockfile。

## JS与`.d.ts`的双合同

以 `goal` 为例：

| 层 | 文件 | 消费者 | 漂移后现象 |
| --- | --- | --- | --- |
| 类型 | `goal.d.ts` | TypeScript/编辑器 | 合法调用判断错误 |
| 运行 | `goal.js` | Node/Electron | export缺失/行为错误 |
| package | `exports['./goal']` | resolver | 子路径找不到 |
| 打包 | builder filter | 安装包 | 开发可用、发布缺失 |

一个完整合同测试应同时 import type、require运行符号并在解包目录重复执行。

## pi-tasks 的三层公开面

根入口给pi extension，`./contracts`提供类型/合同，`./store`提供存储操作。`files`还包含upstream与说明文档。公开store不意味着任意调用者可绕过branch-safe/evidence-gated规则；具体mutation边界由实现决定。

课程不能因为description写着“controlled”“branch-safe”就宣称安全保证已完成。名称与描述只是意图，测试/源码才是证据。

## Node版本为何进入运行合同

pi-tasks engines要求Node >=22；根要求>=22.19。语法、ESM loader与Node test runner行为都受版本影响。开发机Node 22.23.2满足数字范围；Electron内置Node版本则由Electron决定，不能只看系统 `node --version`。

adapter在Electron main中加载时，实际宿主是Electron Node runtime。目标包测试需覆盖该宿主或至少核对Electron Node ABI/版本。

## 故障树：`ERR_REQUIRE_ESM`

1. 记录报错的caller与target路径。
2. 查target package `type`与exports condition。
3. 查caller产物module格式（Desktop CommonJS/adapter CommonJS）。
4. 查adapter loader是否应桥接却未执行/陈旧。
5. 查开发路径与打包路径是否加载不同副本。
6. 用最小Node/Electron require/import fixture复现。

盲目把整个项目改成ESM会波及Desktop main、scripts与exports，不是最小恢复。

## 测试矩阵

| 测试 | 当前脚本入口 | 主要证明 | 仍未证明 |
| --- | --- | --- | --- |
| verify-runtime | adapter test前置 | runtime文件/加载约束的一部分 | Electron打包态 |
| Node unit/integration | adapter `node --test` | Node宿主行为 | browser/真实供应商 |
| pi-tasks test | `node --test test/*.test.js` | task实现断言 | adapter集成 |
| pi-tasks typecheck | tsc check JS | 静态JS合同 | 实际副作用正确 |
| Desktop package verify | Desktop scripts | 分发文件/require | 全平台业务E2E |

## 具体输入推演：adapter build 缺失

```text
Desktop dev
→ adapter build-runtime.js
→ 期望入口 JS 和 dist 就绪
→ concurrently 才启动
```

若 build 失败，Desktop dev 在启动 Next 前停止。若 build 返回成功但漏生成 `ai.js`，后续 Core/Next 解析对应 export 时失败。若 JS 存在而 `.d.ts` 缺失，运行可能成功但类型检查失败。三种现象对应不同输出合同。

## 失败诊断：CommonJS 与 ESM 不匹配

先确认调用入口的 exports condition：adapter 提供 require/default，pi-tasks 提供 import/default。再检查生成文件自身模块语法、调用者 module 设置和 Node 版本。不要仅凭扩展名猜测；package `type` 与 exports condition共同决定解释方式。

## 测试证据与缺口

manifest 明确给出验证命令，但本章未执行 adapter build/test，也未读取 build-runtime 内部步骤，因此不声称 JS 与声明当前同步。C13 的打包清单证明 adapter 文件会被复制的意图，仍不证明每个 export 都包含在安装包。

Given adapter已build；When对exports表逐项执行类型fixture与Node require，再在unpacked app路径重复require；Then符号集合和类型签名应一致。若前者通过后者失败，责任转向builder清单/运行依赖，不应修改业务调用方。

## 源码实验室：CommonJS 适配器怎样声明双重合同

[Agent manifest 第 5—17 行](../../../../packages/agent/package.json#L5) 同时声明运行入口、类型入口和条件 exports：

```json
"main": "./index.js",
"types": "./index.d.ts",
"scripts": {
  "build": "node build-runtime.js",
  "prepare": "node build-runtime.js"
},
"exports": {
  ".": {
    "types": "./index.d.ts",
    "require": "./index.js",
    "default": "./index.js"
  }
}
```

Node 的 CommonJS 消费者走 `require`，TypeScript 走 `types`。JS 成功生成而 `.d.ts` 陈旧会造成“运行正常但类型错误”；反过来只有声明文件则编译可能通过、运行时报模块缺失。

adapter 对 pi-tasks 的边在 [Agent manifest 第 43—50 行](../../../../packages/agent/package.json#L43)：

```json
"@earendil-works/pi-agent-core": "0.80.10",
"@earendil-works/pi-coding-agent": "0.80.10",
"@originos/pi-tasks": "workspace:0.2.0-originos.1"
```

固定上游版本减少适配器面对的 API 组合；workspace 版本约束又要求本地 fork 与 adapter 预期同步。

pi-tasks 自己是 ESM，见 [pi-tasks manifest 第 5—18 行](../../../../packages/pi-tasks/package.json#L5)：

```json
"type": "module",
"main": "./index.js",
"exports": {
  ".": {
    "types": "./index.d.ts",
    "import": "./index.js",
    "default": "./index.js"
  },
  "./contracts": {
    "types": "./src/contracts.d.ts",
    "import": "./src/contracts.js"
  }
}
```

因此 adapter build-runtime 必须处理 CommonJS/ESM 边界，不能简单假设 `require('@originos/pi-tasks')` 在所有位置同步成功。

### 验证闭环

应分别验证 `require`、动态 `import`、每个 exports 子路径以及 JS/声明形状；当前 Desktop 的包体测试只覆盖特定运行资源，不能推广为所有入口完整。

## 小实验与口头验收

1. 对 `@originos/pi-agent-adapter/goal` 写出运行文件与类型文件。
2. 为什么 adapter build 是 Desktop dev 的前置步骤？
3. 比较 adapter 的 CommonJS exports 与 pi-tasks 的 ESM exports。
4. 给“编辑器正常、运行时报 export 不存在”列出最可能的合同漂移。

### 实验参考推演

第1题：resolver读取exports `./goal`，类型走goal.d.ts，CommonJS运行走goal.js。

第2题因为Desktop/Core上游要加载生成JS；manifest不指adapter源码TS，build缺失会在模块解析/加载阶段失败。

第3题adapter默认CommonJS/require，pi-tasks声明type module/import；桥接必须由loader/build处理。

第4题优先查`.d.ts`声明了而`.js`未导出，或package exports/打包只包含一侧；类型断言不能修复。

## 源码阅读顺序

1. 读adapter name/main/types/exports，建立双文件合同。
2. 读scripts确定build/prepare/test生产者与验证者。
3. 读精确上游版本和pi-tasks workspace边。
4. 对照pi-tasks type/exports/files/engines。
5. 再进入build-runtime/load-runtime实现；未读前不声称桥接细节。

## 迁移验收：新增adapter子路径

实现/生成JS与声明；更新exports条件；更新verify-runtime逐项加载；检查Desktop builder白名单；从Core/Web目标环境import；在Electron unpacked包require；同步版本与文档。若只给types没有JS，合同测试必须失败。

下一课进入质量门：规范写在文档里、规则写在 ESLint 里、命令写在 hook 里，只有真正能运行的那一段才形成自动执行证据。
