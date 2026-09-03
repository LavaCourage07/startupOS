# C05：同名 `build` 不代表同一条构建流水线

## 两个命令，同一个词，不同副作用

`pnpm build` 与 `pnpm desktop:build` 都含 `build`，结果却不同。前者只进入 Web 的 `next build`；后者进入 Desktop 的 `build:app`，串联 adapter、Web、复制脚本、TypeScript、验证脚本和产物整理。

本章解决“如何展开脚本链”，并特别检查 `turbo.json`：配置文件存在，不代表当前根脚本已经调用 Turbo。

## 两条真实脚本链

```mermaid
flowchart TD
    A[pnpm build] --> B[根 scripts.build]
    B --> C[@originos/web build]
    C --> D[next build]
    E[pnpm desktop:build] --> F[根 scripts.desktop:build]
    F --> G[@originos/desktop build:app]
    G --> H[adapter build]
    H --> I[web build]
    I --> J[prepare standalone 与 runtime deps]
    J --> K[desktop tsc]
    K --> L[artifact 与 worker 验证]
```

每根箭头都由 script 字符串中的下一个命令产生。第二条链中的步骤以 `&&` 串联：前一步非零退出时，后一步不应继续。这是控制流，不是并行任务图。

## 第一段源码：Web 构建很窄

[根 manifest 第 36—48 行](../../../../package.json#L36) 把 `build` 转发给 Web； [Web manifest 第 5—12 行](../../../../packages/web/package.json#L5) 再把它定义为 `next build`。因此根 `pnpm build` 的直接产物预期是 Web `.next`，不会主动编译 Desktop main。

## 第二段源码：Desktop 构建是显式序列

[Desktop manifest 第 6—21 行](../../../../packages/desktop/package.json#L6) 的 `build:app` 很长，但应按阶段读：

1. 删除旧 `.next` 与根 `dist-electron`；
2. 构建 `@originos/pi-agent-adapter`；
3. 构建 `@originos/web`；
4. 准备 Web standalone 与 pi-ai 运行依赖；
5. 执行 Desktop 自身 `tsc -p tsconfig.json`；
6. 检查根产物、worker runtime；
7. 把根 `dist-electron` 复制到 package 内打包目录；
8. 再检查一次根产物。

这里的 `pnpm build` 出现在 Desktop package cwd 中，因此解析为 Desktop 自己的 `scripts.build`，即 `tsc -p tsconfig.json`；它不是返回仓库根再次执行 Web build。判断脚本时，cwd 与 manifest 同样重要。

## 第三段源码：Turbo 配置存在，但当前脚本没有调用它

[turbo.json](../../../../turbo.json#L1) 为 `build` 声明 `dependsOn: ["^build"]` 和输出缓存，为 `dev` 声明 persistent、禁用缓存，也定义 lint 与 type-check 的上游依赖。

然而根 manifest 没有 `turbo run build`，当前依赖中也没有列出 `turbo`。所以准确表述是：仓库保留了一份 Turbo 任务图配置；从当前根脚本不能证明日常 `pnpm build` 会读取它。把它讲成已接通的生产编排器会违反“源码存在不等于链路接通”。

## 顺序脚本与任务图是两种编排模型

Desktop `build:app` 把命令按文本顺序写死；Turbo 配置则用任务名、依赖关系与输出描述图。二者的差异不只是语法：

| 维度 | shell `&&` 序列 | Turbo 任务图 |
| --- | --- | --- |
| 顺序来源 | 文本从左到右 | package graph + `dependsOn` |
| 并行机会 | 除非显式并行，否则无 | 独立任务可调度 |
| 缓存 | 工具自行处理 | 依据 inputs/outputs 缓存 |
| 失败传播 | 后续命令不执行 | 依赖失败阻断下游 |
| 可见范围 | 当前 script 明确列出 | 所有匹配 package task |
| 当前 root build | 已接通 | 未接通 |

因此不能在教材图中把 Desktop 的 shell 序列画成 Turbo 自动推导，也不能因为 Turbo 更抽象就断言它一定更适合当前打包脚本。复制、平台签名等步骤常有顺序与副作用，需要独立设计缓存/幂等性。

## 逐字段读 `turbo.json`

[turbo.json 第 3—17 行](../../../../turbo.json#L3) 的 `build.dependsOn: ["^build"]` 表示某 package build 之前先完成依赖 package 的同名 build；前缀 `^` 指向 package graph 上游，不是当前 package 的另一个 script。

`outputs` 把 `.next`、dist、dist-electron 登记为缓存结果，并排除 `.next/cache`。这只告诉 Turbo“若它执行任务，哪些文件属于结果”；不会创建这些目录，也不会验证结果内容。

`dev.cache: false`、`persistent: true` 适合长期 server/watch，表示不把 dev 当一次性可缓存任务。lint/type-check 的上游依赖同样只有在 Turbo 被调用时生效。

## cwd 怎样改变同一段 `pnpm build`

根 cwd：`pnpm build` 查根 manifest → 转发 Web。

Desktop package cwd：Desktop `build:app` 内的 `pnpm build` 查 Desktop manifest → 运行 `tsc -p tsconfig.json`。

Web package cwd：`pnpm build` 查 Web manifest → `next build`。

字符串相同，manifest 选择不同。排查构建日志时必须记录 cwd；只复制命令文本无法复现。

## 对 `build:app` 做阶段所有权标注

| 阶段 | 所有者 | 主要输入 | 主要输出/副作用 |
| --- | --- | --- | --- |
| 清理 | Desktop script | 旧 `.next`/dist | 删除明确目录 |
| adapter build | Agent package | adapter 源/上游 runtime | JS、声明与 dist |
| Web build | Web/Next | Web + Core 源码 | `.next` |
| standalone 准备 | Desktop scripts | `.next/standalone` | `.packaging/web-standalone` |
| runtime deps 准备 | Desktop scripts | pi-ai 依赖 | `.packaging/pi-ai-runtime` |
| Desktop compile | TypeScript | Desktop/Core selected src | 根 `dist-electron` |
| 验证 | Node scripts | 生成物 | 退出码/诊断 |
| 整理 | shell copy | 根 dist-electron | package 内 dist-electron |

这张表是后续反向诊断的地图。某输出缺失时，从拥有它的阶段向上查，而不是从最终 electron-builder 一路猜。

## 部分成功：长脚本最容易被忽视的状态

`&&` 阻止后续继续，却不会撤销前面已完成的删除、编译和复制。例如 worker 验证失败时，adapter、Web 与 Desktop 编译可能都已成功，根 dist 已更新，但 package 内最终复制尚未发生。

所以构建结果至少有四种状态：

- 完成：所有阶段零退出；
- 受控失败：某阶段非零并阻断下游；
- 部分成功：上游产物已变化，下游未完成；
- 陈旧成功假象：旧产物仍存在，当前失败没有覆盖它。

日志、退出码与产物修改时间要一起看，不能只问“目录存在吗”。

## 故障反推：worker 验证失败

1. 确认失败命令是 `verify-agent-worker-runtime.js`，不是 tsc。
2. 检查它读取根 dist 还是 package 内副本。
3. 回查 Desktop tsconfig 是否 include worker 源码。
4. 核对相关 Core 输出路径与 module format。
5. 修源码/编译配置后从拥有该产物的阶段重跑；若脚本前置清理很重要，再执行完整链。

直接跳过验证能生成安装包，却把已知 runtime 缺口推给用户机器，不属于恢复。

## 输入、分支与副作用

给定 `pnpm desktop:build`：

```text
输入脚本名
→ filter 到 Desktop
→ 旧产物删除
→ adapter dist 更新
→ Web .next 更新
→ standalone 复制
→ Desktop TS emit 到根 dist-electron
→ 验证脚本读取产物
→ package 内打包目录获得副本
```

若 adapter build 失败，Web build 不会开始；若 Web build 失败，旧 `.next` 已被删除，属于“失败但已有副作用”。因此长脚本不是事务，不能假设失败会自动恢复到开始前状态。

## 测试证据与缺口

本章通过静态展开 manifest 确认命令顺序，没有执行会删除并重建大型产物的 `desktop:build`。因此没有声称这条流水线当前通过。`turbo.json` 也只被读取，没有证据显示当前 root script 消费它。

可补两类自动证据：一类解析 manifest，断言 Desktop build:app 的关键阶段顺序；另一类在临时输出目录运行构建并故意让中间验证失败，断言后续复制/打包没有执行。前者防脚本意外删步骤，后者固定失败传播，但仍不替代目标平台启动。

## 源码实验室：把 `build:app` 当作短路控制流阅读

根入口只有一层转发，见 [package.json 第 49—51 行](../../../../package.json#L49)：

```json
"desktop:dev": "pnpm --filter @originos/desktop dev",
"desktop:build": "pnpm --filter @originos/desktop build:app",
"desktop:dist": "pnpm --filter @originos/desktop dist"
```

输入 `pnpm desktop:build` 后，根进程选择 Desktop 的 `build:app`。它不会执行 `desktop:dist`，所以此时还没有 electron-builder 安装包。

真正的顺序位于 [Desktop manifest 第 8—12 行](../../../../packages/desktop/package.json#L8)：

```json
"build": "tsc -p tsconfig.json",
"build:app": "rm -rf ../web/.next ../../dist-electron && pnpm --filter @originos/pi-agent-adapter build && pnpm --filter @originos/web build && node scripts/prepare-web-standalone.js && node scripts/prepare-pi-ai-runtime-deps.js && pnpm build && node ../../scripts/check-root-build-artifacts.js && node scripts/verify-agent-worker-runtime.js && rm -rf dist-electron && mkdir -p dist-electron && cp -R ../../dist-electron/. dist-electron/ && node ../../scripts/check-root-build-artifacts.js",
"dist": "pnpm build:app && electron-builder --config electron-builder.yml --publish never"
```

`&&` 提供短路，不提供事务：Web build 已写入 `.next` 后，runtime 准备失败不会自动撤销前置输出。

对照 [turbo.json 第 3—17 行](../../../../turbo.json#L3)：

```json
"build": {
  "dependsOn": ["^build"],
  "outputs": [".next/**", "!.next/cache/**", "dist/**", "dist-electron/**"]
},
"dev": { "cache": false, "persistent": true }
```

这是 Turbo 可理解的任务图，但当前入口没有调用 `turbo run`。因此它是“存在的配置能力”，不是生产构建已经经过的阶段。

### 用退出码定位第一失败边界

若 `prepare-web-standalone.js` 退出 1，adapter build 与 Web build 已发生，后续 runtime 准备、Desktop tsc、worker 验证和复制均未发生。恢复时应保存第一条错误，再决定是否清理已生成的 `.next`；查看 `release` 没有诊断价值，因为流程尚未进入打包。

### 测试证据与未覆盖风险

仓库没有自动化测试逐阶段注入失败并断言短路位置。静态解析 manifest 能证明书写顺序，不能证明每个脚本在当前平台可运行。高价值集成测试应令第 N 步失败，断言 N+1 之后没有执行，并记录已经存在的副作用。

## 小实验与口头验收

1. 给 Desktop `build:app` 每个阶段标注输入与产物。
2. 假设 Web build 失败，哪些前置副作用已经发生，哪些后续步骤不会发生？
3. 解释为什么“仓库有 turbo.json”不能推出“pnpm build 使用 Turbo”。
4. 迁移练习：若将根 build 改成 `turbo run build`，还需核对 package 中哪些 script 与输出声明？

### 实验参考推演

第1题可用阶段所有权表逐项标记；若某阶段没有明确输出，就不能判断后续消费者是否有输入。

第2题：adapter可能已更新、旧Web `.next` 已删；standalone、Desktop tsc、验证和复制均不会执行。这是部分副作用后的受控失败。

第3题：生产调用点没有 `turbo`，依赖也未声明。配置存在只说明预留任务图。

第4题需保证每个依赖package都有同名build，outputs覆盖真实目录、dev持久任务不被错误缓存、Desktop平台脚本仍保留必要顺序与验证。

## 源码阅读顺序

1. 根manifest只定位build/desktop:build两条入口。
2. Web manifest确认next build的窄链。
3. Desktop manifest将build:app按`&&`分段抄写。
4. 每段反向打开其package/script，不要把内层pnpm build当根命令。
5. 最后读turbo.json并搜索调用者，确定“存在但未接通”。

## 迁移验收：将Web/Core检查纳入发布前链

先定义质量门失败是否应在清理旧产物前发生。理想顺序通常让无副作用的lint/type/test尽早失败，再进入清理和大型构建；但Core当前脚本/依赖需先补齐。迁移后要故意制造Web类型错、Core测试错、worker验证错，分别确认停止位置和残留产物。

下一课进入 TypeScript：同一份 `.ts` 文件最终使用哪些编译选项，不能只看离它最近的一个配置字段。
