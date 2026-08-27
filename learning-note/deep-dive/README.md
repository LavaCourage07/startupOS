# OriginOS 深入学习教程

这一版不是前面 12 节宏观课的加长版，而是面向“真正读懂项目、能参与实现”的深入课程。

当前深入版按 **72 节源码课 + 4 个综合实战** 设计。它不是只看主线，而是以全仓文件覆盖矩阵为依据，把源码、文档、skills、OpenSpec、测试和运行数据分成精读、通读、索引、登记四类。

## 学习目标

学完这一版，你应该能做到：

- 说清 OriginOS 的产品目标、技术栈、运行方式和架构约束；
- 从用户点击一路追到 Web UI、API route、core service、Agent runtime、文件存储；
- 理解 Codex skills、OpenSpec、Story 文档、AGENTS.md 如何共同约束开发流程；
- 看懂核心组件：桌面、窗口、Dock、SkillDialog、AgentDialog、Workspace、Project Interview、Ontology、Memory、Collaboration runtime；
- 知道每个功能域的源码入口、数据流、关键类型、测试入口；
- 能设计并实施一个小到中等规模的变更，并知道如何写 proposal、design、tasks、spec 和验证证据。

## 重要说明：关于“完整阅读”

当前扫描结果：

- 全仓文件总数：2232
- 可读文本文件：2097
- 可读文本总行数：434145
- 图片或二进制资产：36
- `.git`、依赖、构建产物等排除登记项：85

这意味着不能用“几节概览课”假装吃透项目。深入教程采用可审计的阅读方法：

1. 先建立完整文件清单和模块统计；
2. 标记构建产物、依赖、缓存、运行数据与源码的区别；
3. 按功能域阅读每个目录；
4. 对每个功能域提取：入口、关键文件、数据流、类型、测试、风险；
5. 每一章都回到真实路径，不凭印象讲。

## 当前文档

- [00 全量阅读清单](00-reading-inventory.md)
- [01 深度课程设计](01-deep-curriculum.md)
- [02 源码系统地图](02-system-source-map.md)
- [03 OpenSpec 与 Codex Skills](03-openspec-and-codex-skills.md)
- [04 深度课程完整性审计](04-completeness-audit.md)
- [05 全项目文件覆盖矩阵](05-file-coverage-matrix.md)
- [72+4 最终课程大纲](final-outline/README.md)
- [A1 产品主线和真实目标](10-a1-product-source-of-truth.md)
- [A2 技术栈和 Monorepo](11-a2-tech-stack-monorepo.md)
- [A3 架构规约](12-a3-architecture-rules.md)
- [B1 Next.js App Router 入口](13-b1-nextjs-app-router.md)

## 推荐学习方式

先读 `00` 和 `01`，确定整体路线。再读 `02` 建立源码地图。之后按课程顺序深入每个功能域。

这版教程不会刻意浅，但每章都会坚持三件事：

- 先讲人话，再讲源码；
- 先画图，再追文件；
- 先讲主线，再补边界和例外。
