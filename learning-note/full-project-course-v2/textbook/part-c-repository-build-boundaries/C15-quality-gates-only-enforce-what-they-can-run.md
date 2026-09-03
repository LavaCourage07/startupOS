# C15：质量门只会执行真实命令，不会自动理解架构愿望

## “提交前会自动检查”需要哪些证据

AGENTS.md 要求严格 TypeScript、单向依赖和提交前 lint。仓库也有 ESLint、Prettier、Husky 与自定义检查脚本。最危险的教材写法是看到这些文件就宣称规约已被完整自动化。

本章逐层区分规范、工具规则、脚本连接与真实执行结果。

## 四层质量门

```mermaid
flowchart LR
    A[AGENTS.md 规范] -->|翻译一部分| B[ESLint 与 TS 配置]
    B -->|由 script 调用| C[package scripts]
    C -->|pre-commit 顺序执行| D[提交门]
    D -->|退出码 0| E[允许提交继续]
```

每根箭头都可能有缺口：规范不一定被规则覆盖；规则存在不一定被脚本调用；脚本名存在不一定命令可运行；退出码为零也只证明扫描范围内没有被规则发现的问题。

## 第一段源码：ESLint 的强制等级并不统一

[ESLint 配置第 13—38 行](../../../../.eslintrc.json#L13) 将 self-import 设为 error，却关闭 cycle 检查；`no-explicit-any` 等多项规则只是 warn。 [第 38—106 行](../../../../.eslintrc.json#L38) 的 restricted paths 也使用 warn。

因此 AGENTS.md 的“禁止 any”“严格禁止循环”没有被这份 ESLint 配置以 error 完整落实。规范仍有效，但工具自动门的实际力度更弱。修复架构不能只问“lint 是否零退出”。

配置中的 zone 路径使用根 `./src/...`，而真实主要源码位于 `packages/web/src` 与 `packages/core/src`。是否能按预期匹配还取决于 ESLint cwd 与 resolver；不能仅凭注释宣称所有跨包层级都被覆盖。

## 第二段源码：禁用技术与代码风格

[ESLint 配置第 108—142 行](../../../../.eslintrc.json#L108) 将 Redux、MobX、Styled Components、数据库/后端框架等 import pattern 设为 error；React 规则多为 warn。 [第 229—242 行](../../../../.eslintrc.json#L229) 将 `prefer-const`、`no-var` 设 error，复杂度与函数行数设 warn。

这说明同一份 lint 输出里，“警告”“错误”代表不同门槛。若 CI 没启用 `--max-warnings 0`，警告通常不会导致非零退出。

## 第三段源码：Prettier 负责形状，不负责架构

[Prettier 配置](../../../../.prettierrc.json#L1) 规定分号、单引号、80 列、2 空格与 Tailwind class 排序插件； [`.prettierignore`](../../../../.prettierignore#L1) 排除依赖、构建、coverage、env、tsbuildinfo 等。

Prettier 可以重排代码和 class，却不会检测 Web 是否反向被 Core 依赖，也不会判断业务逻辑是否放错目录。格式一致与架构合规是不同证据。

## 第四段源码：当前 pre-commit 存在断链

[pre-commit hook 第 1—44 行](../../../../.husky/pre-commit#L1) 依次运行：

```text
npm run type-check
→ npm run lint
→ npm run format:check
→ npm run agents:check
```

但当前根 [package.json scripts 第 36—67 行](../../../../package.json#L36) 没有 `format:check` 或 `format`。所以 hook 执行到第三步会因缺脚本失败；错误提示建议的 `npm run format` 也不存在。这里必须写成真实缺口，而不是“Prettier 检查已接通”。

另外根 `type-check` 与 `lint` 只过滤 Web；自定义 `agents:check` 从 `process.cwd()/src` 扫描，而根目录当前没有主 `src`，脚本会提示跳过。它不能据此证明 packages 下依赖全部合规。

## 逐段读 pre-commit 的控制流

hook不是声明式任务图，而是四段重复shell结构：执行命令 → 读取 `$?` → 非零时打印提示并 `exit 1`。只要某段退出，后续不执行；前面工具的缓存/格式副作用不会回滚。

最后 `exit 0` 只有四段都没有触发失败时到达。若某检查错误地“跳过并返回0”，hook仍把它当成功。因此退出码语义必须结合工具输出阅读。

hook 文件存在还不证明 Git 已安装/启用它。当前根 manifest 没有 Husky `prepare` script，依赖列表中也未见 `husky`；当前 `git config --get core.hooksPath` 没有返回配置，`.husky/pre-commit` 权限为 `-rw-r--r--`，也没有可执行位。正文关于四段控制流描述的是“该文件被 Git 调用之后”的行为；当前证据反而表明不能宣称它会在每次提交时自动触发。

## `npm run` 与项目 packageManager 的不一致

根声明packageManager为pnpm，hook却调用`npm run`。npm会读取同一根scripts，但workspace协议安装、PATH与生命周期行为可能与pnpm不同。这里不一定立刻失败，却增加环境差异。

更一致的门禁通常使用根声明的pnpm版本/命令；是否修改属于工程决策，本章只指出实际调用者是npm，不能在验证记录里悄悄写成pnpm。

## 自定义依赖脚本的真实扫描算法

[check-agents-compliance.js 第 11—31 行](../../../../scripts/check-agents-compliance.js#L11) 定义层级；第 58—85 行用正则只解析 `import ... from` 的相对路径与 `@/` alias；第 159—177 行递归扫描传入目录；主函数第186行固定 `process.cwd()/src`。

当前根没有主 `src`，所以第188—190行打印跳过并return 0。即使从某package cwd运行，脚本的层级表混合了Web/Core目录概念，且不会识别：

- `require()`、动态 `import()`；
- `export ... from`；
- `@originos/core/...` package import；
- Desktop跨包多层相对路径在根扫描外；
- type-only特殊写法/多行复杂import可能受regex限制。

因此它是一项有限静态扫描器，不是完整依赖图证明。

## ESLint restricted paths的方向怎样读

`target` 是被检查文件区域，`from` 是它不应导入的来源区域。注释、message与实际zone若方向写反，工具可能检查与文字相反的关系。审计时要用一个故意违规fixture验证，而不是只读中文message。

当前zone路径也以 `./src` 为根，而Web lint从 `packages/web`执行、配置位于仓库根。ESLint如何解析basePath需要实际debug/fixture确定。未运行前不能把所有zone标“已生效”。

## lint warning为何可能放行

ESLint默认有error才非零；warn可以显示但退出0，除非命令加`--max-warnings 0`。Web script是`eslint src --ext .ts,.tsx`，没有该选项。

所以 `no-explicit-any: warn` 意味着hook可能打印warning后继续。AGENTS.md仍禁止any；自动门与人工review要补齐差距。

## Next build又绕开了两道门

C09看到ignoreDuringBuilds与ignoreBuildErrors。即使hook原本设计独立lint/type-check，开发者直接运行build可能获得成功产物。构建脚本没有自动先调用质量门。

CI/发布流程必须显式编排：lint/type-check/test/build/verify，而不能把Next build当总门。

## Prettier插件本身也是依赖

`.prettierrc`加载`prettier-plugin-tailwindcss`。format命令即使补上，插件缺失/版本不兼容也会在配置加载阶段失败。`.prettierignore`排除文件不会验证其内容，只是不格式化。

格式测试应在一个故意乱序class fixture上运行，确认插件实际加载；只解析JSON不够。

## 建立质量门覆盖矩阵

| 区域 | type-check | lint | format | dependency scan | tests |
| --- | --- | --- | --- | --- | --- |
| Web | 根脚本意图覆盖 | 根脚本覆盖src | 当前缺script | 根扫描未覆盖 | 根test过滤Web |
| Core | 无根显式script | 根lint不覆盖 | 当前缺script | 根扫描未覆盖 | 需显式Core命令 |
| Desktop | build中tsc emit | 根lint不覆盖 | 当前缺script | 根扫描未覆盖 | 需Desktop test |
| Adapter | build/test自有 | 无根lint证据 | 当前缺script | 不解析JS | 需adapter test |
| pi-tasks | 自有typecheck | 无根lint证据 | 当前缺script | 不解析JS | 自有Node test |

这张表说明“pre-commit存在”与“全仓覆盖”之间的实际空洞。

## 正确修复门禁的顺序

1. 决定每项检查的目标范围与阻断等级。
2. 为根/package补真实可运行scripts，统一包管理器。
3. 在临时fixture验证规则确实命中违规、放过合法路径。
4. 让hook/CI调用这些scripts并保留第一条错误。
5. 运行全仓，区分既有债务与新违规。
6. 记录无法自动覆盖的人工review项。

直接把warning全部升error可能一次暴露大量旧债；直接关闭hook则失去门禁。工程迁移要有基线和逐步收紧策略。

## 故障反推：hook显示“所有依赖符合”

这句话不一定是成功。先看前一行是否“src目录不存在，跳过检查”。再确认cwd与扫描文件数；随后用故意违规fixture验证规则。输出文案不能替代扫描输入证据。

## 门禁自动测试

- manifest合同：hook引用的每个script都存在；提示中的修复script也存在。
- negative fixture：每项关键规则至少有一个违规样本，断言非零。
- positive fixture：合法依赖方向零退出。
- scope fixture：Web/Core/Desktop各至少一个文件被扫描。
- integration：pre-commit模拟执行，断言第一项失败阻断后续。

## 正向与反向推演

正常意图：提交 → Web 类型检查 → Web lint → 格式检查 → 依赖检查。当前实际可能是：缺少 TypeScript 二进制先失败；即使前两步可用，format script 仍缺失；即使跳过到 agents check，根 `src` 不存在又会跳过扫描。

故障症状“pre-commit 失败”应先看第一条非零命令，不要删除 hook。恢复方向是补齐并对齐脚本/扫描范围，或明确调整门禁设计，而不是用 `--no-verify` 掩盖断链。

## 测试证据与缺口

本章没有触发 Git commit，也没有修改门禁。静态对照已证明 hook 引用了缺失脚本，且根 `agents:check` 的扫描入口与仓库结构存在范围差异。ESLint 实际匹配哪些文件仍需运行并检查 debug/output；当前依赖环境不完整，未宣称 lint 通过。

本章把源码事实、合理推断和待验证分开：缺失format scripts与根src缺失是直接事实；warning默认放行依据当前命令与ESLint语义；restricted zones实际匹配范围仍需fixture；全仓合规则明确未证明。

## 源码实验室：从规则严重度追到提交是否真的被阻止

[ESLint 配置第 17—33 行](../../../../.eslintrc.json#L17) 同时存在 error、warn 与 off：

```jsonc
"import/no-cycle": "off",
"import/no-self-import": "error",
"@typescript-eslint/no-explicit-any": "warn",
"@typescript-eslint/explicit-function-return-type": "warn",
"@typescript-eslint/no-floating-promises": "off"
```

规则名存在不等于强制：off 不检查，warn 默认通常不导致非零退出，error 才直接阻断。是否把 warning 当失败还取决于命令有没有 `--max-warnings 0`；当前 Web lint script 没有该参数。

hook 的短路逻辑见 [.husky/pre-commit 第 7—28 行](../../../../.husky/pre-commit#L7)：

```sh
npm run type-check
if [ $? -ne 0 ]; then
  exit 1
fi
npm run lint
if [ $? -ne 0 ]; then
  exit 1
fi
npm run format:check
```

每一段检查上一命令退出码并短路。问题是根 manifest 没有 `format:check`，所以 hook 真被执行时会稳定停在第三段；而 hook 文件存在、不可执行且 hooksPath 未配置，又说明“每次提交自动触发”本身尚未成立。

根脚本只定义了 [package.json 第 43—48 行](../../../../package.json#L43)：

```json
"lint": "pnpm --filter @originos/web lint",
"type-check": "pnpm --filter @originos/web type-check",
"test": "pnpm --filter @originos/web test",
"test:coverage": "pnpm --filter @originos/web exec vitest run --coverage"
```

这些聚合命令只覆盖 Web，并不自动检查 Core、Desktop、Agent 或 pi-tasks。质量门的名字不能扩大其实际 filter。

自定义扫描器自身也暴露了范围限制，见 [check-agents-compliance.js 第 11—23 行](../../../../scripts/check-agents-compliance.js#L11)：

```js
const DEPENDENCY_LAYERS = {
  'src/app': 5,
  'src/components': 4,
  'src/services': 3,
  'src/lib/features': 2,
  'src/modules': 2,
  'src/lib/storage': 1,
  'src/lib/integrations': 1,
  'src/lib/shared': 0,
};
```

路径都以根 `src/` 为前提，而当前仓库主要源码位于 `packages/*/src`。实际运行输出“根 src 不存在并跳过”且退出为零，因此这个绿灯证明脚本没有发现其扫描范围内的违规，不证明 package 目录符合 AGENTS.md。

格式规则与忽略范围必须成对阅读。 [.prettierrc.json 第 2—12 行](../../../../.prettierrc.json#L2) 定义输出形状：

```json
{
  "semi": true,
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

而 [.prettierignore 第 1—13 行](../../../../.prettierignore#L1) 排除依赖、构建物和覆盖率目录：

```text
node_modules
.next
out
dist
build
coverage
```

格式化成功只说明未被 ignore 的目标满足这些形状规则；它不会检查依赖方向、类型或测试行为。Tailwind 插件还会重排 class 顺序，因此插件缺失与普通格式差异需要分开诊断。

### 测试与修复顺序

先让 hook 安装/执行证据成立，再补缺失 script，再逐段故意制造 type、lint、format、architecture 错误并断言非零退出，最后验证干净样例通过。只运行脚本一次为零不能证明每个失败分支都能拦截。

## 小实验与口头验收

1. 将“规范、规则、script、hook、退出码”按证据强弱排序。
2. 指出三项 AGENTS 目标没有被当前自动门完整证明的原因。
3. 从 pre-commit 第三步失败定位到缺失的根 script。
4. 为什么 Prettier 通过不能证明依赖方向正确？

### 实验参考推演

第1题不是单向“强弱”，而是链：规范给目标，规则翻译部分目标，script选择范围，hook连接时机，退出码给本次证据；断一环就不能自动强制。

第2题可举Core strict false、cycle rule off、依赖scan根src跳过、warning不阻断、hook是否已接入Git未证明等真实证据。

第3题hook第三段调用不存在的format:check；提示的format也不存在。恢复在根scripts/门禁设计。

第4题Prettier只规范文本形状/class排序，不构建import层级图。

## 源码阅读顺序

1. 从hook按执行顺序列命令，不先读几百行ESLint。
2. 去根manifest核对每个script是否存在与实际范围。
3. 再读TS/ESLint/Prettier配置的阻断等级。
4. 打开自定义agents脚本，确认cwd、扫描根、解析语法与退出分支。
5. 用负向fixture验证，而不是相信成功文案。

## 迁移验收：修复并收紧pre-commit

补齐format scripts且使用pnpm；为Core/Desktop/Adapter定义各自检查；修dependency scanner从workspace包扫描并解析package/dynamic/export语法或换可靠工具；对既有warning制定基线；CI重复运行同门禁。必须故意制造any、循环/反向依赖、格式错、缺script四类失败，确认各自非零并指向正确责任层。

下一课研究测试门：根、Core、Web、Desktop 各有 Vitest 配置，测试在哪个世界运行会改变 DOM、alias、mock 与文件发现范围。
