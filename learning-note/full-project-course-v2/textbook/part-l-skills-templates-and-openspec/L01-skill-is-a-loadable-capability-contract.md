# L01：Skill 不是按钮，而是一份可加载的能力合同

小林已经会从首页打开“毕业旅行策划 Skill”。从用户角度看，她点的是一个卡片；从源码角度看，真正支撑这个能力的不是卡片本身，而是一份可以被读取、解析、注入上下文的定义文件。

本课只解决一个问题：面对一个陌生的 `SKILL.md`，读者怎样判断它定义了什么、没有定义什么，以及它和运行时、工作目录、产物目录之间是什么关系。

## 1. 从可见按钮回到能力合同

用户看到的是“技能入口”，系统读取的是“技能定义”。这两者不能混为一谈。

```mermaid
flowchart LR
    A[用户看到 Skill 入口] --> B[系统定位 SKILL.md]
    B --> C[读取 frontmatter]
    C --> D[读取正文任务说明]
    D --> E[形成可注入的能力上下文]
    E --> F[运行时再决定怎样执行]
```

图中的箭头说明一个 Skill 从文件进入系统理解的顺序。入口负责让用户发起动作，`SKILL.md` 负责说明能力，运行时负责把说明放进具体会话或执行流程。任何一层缺失，都会产生不同症状：入口缺失时用户找不到它；定义缺失时系统不知道它是什么；运行时缺失时定义不会自动变成可执行行为。

## 2. `SKILL.md` 的两层内容

以 [templates/skills/mahjong-scorer/SKILL.md 第 1 行](../../../../templates/skills/mahjong-scorer/SKILL.md#L1) 为例，文件开头是一段 YAML frontmatter：

```yaml
---
name: 麻将计分器
code: mahjong-scorer
description: 三人麻将计分记录器。当用户提到麻将、打牌、胡牌、计分、算分、牌局记录等关键词时使用此技能。
originos-system: true
version: 1.0.0
type: SIMPLE
author: OriginOS
tags:
  - 麻将
  - 计分
  - 游戏
reads:
  - 游戏对局记录
writes:
  - 分数变更记录
prerequisites: []
dependencies: []
---
```

这一段像技能的身份证。它回答“这个技能叫什么”“唯一标识是什么”“何时可能被触发”“读写哪些概念性材料”“是否是系统内置”。它不回答“本轮用户具体说了什么”，也不证明系统已经执行了计分。

从 [templates/skills/mahjong-scorer/SKILL.md 第 21 行](../../../../templates/skills/mahjong-scorer/SKILL.md#L21) 开始是正文。正文说明触发场景、执行步骤、输入格式、输出格式和数据存储。它像给 Agent 的工作说明：当用户说“CL 自摸 6 分”时，应识别赢家、分数和胡牌类型，再更新状态。

因此，一份 Skill 定义至少有两层：

| 层 | 典型内容 | 教学判断 |
| --- | --- | --- |
| frontmatter | `name`、`code`、`description`、`type`、`tags`、`reads`、`writes` | 供系统发现、展示、分类和粗略匹配。 |
| 正文 | Mission、触发场景、步骤、输入输出、注意事项 | 供 Agent 或读者理解具体任务约束。 |

## 3. `code` 和 `name` 的边界

`name` 面向展示，`code` 更像稳定标识。`mahjong-scorer` 的 frontmatter 同时包含中文 `name` 和英文 `code`。如果只看 `name`，读者会以为技能身份就是显示文案；但在目录、产物路径和程序接口里，稳定标识通常比展示名更可靠。

[templates/skills/search-and-install-skill/SKILL.md 第 1 行](../../../../templates/skills/search-and-install-skill/SKILL.md#L1) 也有同样结构：

```yaml
name: 搜索并安装市场技能
code: search-and-install-skill
description: 自动根据用户输入的技能关键词或分类，从技能市场搜索匹配项，分析来源平台，下载并安装。
outputDir: data/
```

这里多了 `outputDir: data/`。这说明该技能希望把安装产物放进某个输出根下，但它仍然只是定义层声明。真正写入哪里，还要看调用方如何解释 `${OUTPUT_DIR}`、当前工作目录是什么、工具是否允许写入、用户是否确认安装。

## 4. 定义文件不等于执行结果

`mahjong-scorer` 的正文在 [templates/skills/mahjong-scorer/SKILL.md 第 44 行](../../../../templates/skills/mahjong-scorer/SKILL.md#L44) 写到应在 `skills/mahjong-scorer/` 目录下创建 `game-state.json`。同目录确实存在 [templates/skills/mahjong-scorer/game-state.json 第 1 行](../../../../templates/skills/mahjong-scorer/game-state.json#L1)：

```json
{
  "players": {
    "GJ": 500,
    "CL": 500,
    "LL": 500
  },
  "rounds": [],
  "startedAt": "2026-06-16T17:20:00+08:00"
}
```

这份 JSON 是一个状态样例或初始状态文件。它说明“如果 Skill 以这种状态开始，三位玩家各 500 分，历史为空”。它不能证明用户已经打过一局，也不能证明运行时一定会写回这个模板目录。对教材来说，正确说法是：源码中存在一个被跟踪的初始状态文件；是否作为运行时状态被消费，需要继续追调用链。

同样，报告文件也不是执行入口。[skills/reports/architecture-guard/architecture-guard-20260729-120736.md 第 12 行](../../../../skills/reports/architecture-guard/architecture-guard-20260729-120736.md#L12) 写有一次检查结论。它证明在报告记录的时间和范围内，检查者得到了对应结论；它不保证今天所有相关代码仍然符合该结论。

## 5. 四类文件的责任对照

| 文件 | 例子 | 能证明什么 | 不能证明什么 |
| --- | --- | --- | --- |
| Skill 定义 | `SKILL.md` | 技能身份、说明、触发场景、读写意图。 | 运行时已经执行、产物已经生成。 |
| 状态文件 | `game-state.json` | 某种结构化状态或初始数据形状。 | 当前用户真实状态、生产调用链一定写它。 |
| 模板文件 | `templates/project-interview/Agent.md` | 初始化文件应该包含哪些段落。 | 该 Agent 已经启动并加载了它。 |
| 报告文件 | `skills/reports/**.md` | 某次检查的范围、结论和残余风险。 | 当前代码仍然通过同一检查。 |

这个表是 Part L 的基础阅读方法。看到文件时先分类，再判断证据强度，最后才追执行链。

## 6. 失败路径

Skill 定义最常见的失败不是语法崩溃，而是边界误读。

第一种失败是身份误读。把 `name` 当成唯一 ID，可能导致显示名改变后找不到原目录。第二种失败是目录误读。把 `templates/skills/**` 当成用户产物目录，可能污染模板源文件。第三种失败是能力误读。看到 `writes` 就以为文件已经写入，会把计划和事实混在一起。第四种失败是证据误读。看到报告 `PASS` 就认为当前代码已被验证，会忽略报告的时间、范围和残余风险。

## 7. 测试证据与缺口

本课读取的是模板、状态样例和报告文件，没有执行自动化测试。当前证据来自三个层次：文件存在并能被行号定位，frontmatter 与正文能被人工精读，报告文件自身记录了检查时间、范围和残余风险。

这些证据不能证明 Skill 已经被生产入口加载，也不能证明 `game-state.json` 会在真实运行时被写回。若要把“定义文件存在”推进到“运行行为成立”，后续必须结合 Part E/F/G 的 Skill loader、launcher、工具调用和相关测试。

## 8. 小实验与口头验收

选择 [templates/skills/mahjong-scorer/SKILL.md](../../../../templates/skills/mahjong-scorer/SKILL.md) ，完成以下纸面实验：

1. 标出 frontmatter 中哪些字段用于展示，哪些字段用于身份，哪些字段描述读写意图。
2. 找到正文中第一次说明文件副作用的位置，写出它希望创建或更新的路径。
3. 打开 `game-state.json`，说明它是初始状态、当前状态还是运行结果；如果无法证明，要写出“当前只能证明什么”。
4. 假设用户把 `name` 改成“记分器”，判断 `code` 不变时哪些路径仍可能稳定。
5. 假设报告文件中写着 `PASS`，说明为什么仍不能把它当作当前生产行为证明。

合上本课后，应能准确复述：Skill 是一份能力合同；frontmatter 描述身份和元信息，正文描述任务和边界；状态、模板、报告都可以支持理解，但都不能自动替代运行时证据。下一课会进一步精读 Project Interview 模板，看一个 Agent 工作目录在创建前怎样被拆成多份文件。
