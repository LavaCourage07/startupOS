/**
 * Ask User Question Tool
 * 让 Agent 主动向用户提出问题（单选/多选）
 */

import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import type { AgentToolResult } from "@originos/pi-agent-adapter";
import type { AgentToolUpdateCallback } from "@originos/pi-agent-adapter";
import type { ToolRegistration } from "../types";

const AskUserQuestionParamsSchema = Type.Object({
  question: Type.String({
    description: "要问用户的问题内容",
  }),
  options: Type.Array(
    Type.Object({
      label: Type.String({ description: "选项显示文字" }),
      description: Type.String({ description: "选项说明" }),
    }),
    { description: "可选项列表" }
  ),
  multiSelect: Type.Boolean({
    description: "是否允许多选",
    default: false,
  }),
});

const AskUserQuestionTool: ToolRegistration = {
  name: "ask_user_question",
  label: "向用户提问",
  description:
    "向用户提出一个问题，提供多个选项让用户选择。用于在对话中获取用户的决策。支持单选和多选。",
  parameters: AskUserQuestionParamsSchema,
  category: "system",
  enabled: true,
  async execute(
    toolCallId: string,
    params: Static<typeof AskUserQuestionParamsSchema>,
    signal?: AbortSignal,
    onUpdate?: AgentToolUpdateCallback<unknown>
  ): Promise<AgentToolResult<unknown>> {
    if (signal?.aborted) {
      return {
        content: [{ type: "text" as const, text: "操作已取消" }],
        details: undefined,
      };
    }

    // Send the question as a tool update so the client can render an interactive card
    if (onUpdate) {
      onUpdate({
        content: [],
        details: {
          type: "progress",
          toolCallId,
          toolName: "ask_user_question",
          status: "in_progress",
          message: params.question,
          data: {
            question: params.question,
            options: params.options,
            multiSelect: params.multiSelect,
          },
          timestamp: Date.now(),
        },
      });
    }

    // Return immediately with the question YAML as the result.
    // The frontend renders the interactive card from tool_start args,
    // and user answers are delivered via a separate API call that appends
    // a new user message with the selected values.
    const yaml = `\`\`\`yaml
question: "${params.question}"
options:
${params.options.map(o => `  - label: "${o.label}"\n    description: "${o.description}"`).join('\n')}
multiSelect: ${params.multiSelect}
\`\`\``;

    return {
      content: [
        {
          type: "text" as const,
          text: yaml,
        },
      ],
      details: undefined,
    };
  },
};

export const askUserQuestionTools: ToolRegistration[] = [AskUserQuestionTool];
