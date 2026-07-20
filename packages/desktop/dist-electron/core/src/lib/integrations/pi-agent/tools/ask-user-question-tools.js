"use strict";
/**
 * Ask User Question Tool
 * 让 Agent 主动向用户提出问题（单选/多选）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.askUserQuestionTools = void 0;
const typebox_1 = require("@sinclair/typebox");
const AskUserQuestionParamsSchema = typebox_1.Type.Object({
    question: typebox_1.Type.String({
        description: "要问用户的问题内容",
    }),
    options: typebox_1.Type.Array(typebox_1.Type.Object({
        label: typebox_1.Type.String({ description: "选项显示文字" }),
        description: typebox_1.Type.String({ description: "选项说明" }),
    }), { description: "可选项列表" }),
    multiSelect: typebox_1.Type.Boolean({
        description: "是否允许多选",
        default: false,
    }),
});
const AskUserQuestionTool = {
    name: "ask_user_question",
    label: "向用户提问",
    description: "向用户提出一个问题，提供多个选项让用户选择。用于在对话中获取用户的决策。支持单选和多选。",
    parameters: AskUserQuestionParamsSchema,
    category: "system",
    enabled: true,
    async execute(toolCallId, params, signal, onUpdate) {
        if (signal?.aborted) {
            return {
                content: [{ type: "text", text: "操作已取消" }],
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
                    type: "text",
                    text: yaml,
                },
            ],
            details: undefined,
        };
    },
};
exports.askUserQuestionTools = [AskUserQuestionTool];
