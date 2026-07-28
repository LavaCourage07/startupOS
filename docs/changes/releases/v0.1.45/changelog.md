# OriginOS CE v0.1.45 Changelog

发布日期：2026-07-28

## 修复

- 修复流式消息完整到达渲染进程后，界面仍可能只显示开头两个字的问题。
- 流事件改为按 32ms 上限主动推进累计文本，定时器仅作为补帧兜底。
- 最终消息到达时同步提交剩余正文，不再依赖可能被延迟的渲染定时器。
- 普通 Agent、持久 Agent 和项目 Agent 的 `done` 事件统一携带最终正文。

## 诊断

- 增加流输入提交、定时器调度、定时器触发和最终提交日志。
- 日志记录累计长度与渲染长度，便于定位流传输和前端渲染之间的差异。

## 验证

- Windows StreamRenderScheduler 单元测试：8 项通过。
- Core TypeScript 检查通过。
- Desktop TypeScript 检查通过。
- 243 字模拟流完成 51 次渐进提交，并以完整正文结束。
- Windows、macOS 构建、签名、更新元数据、七牛资源和 GitHub Release 由 GitHub Actions 发布链路继续验证。
