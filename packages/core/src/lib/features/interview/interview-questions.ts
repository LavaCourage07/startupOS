/**
 * 访谈问题配置
 *
 * 参考: docs/specs/epic-1/story-1.2/requirements.md
 * 参考: docs/specs/epic-1/story-1.2/interaction.md
 */

export interface InterviewQuestion {
  /** 问题唯一标识 */
  id: string;
  /** 问题文本 */
  question: string;
  /** 占位符文本 */
  placeholder: string;
  /** 提示信息 (详细) */
  hint: string;
  /** 提示信息 (简短) */
  hintShort: string;
  /** 最小字符数 */
  minLength?: number;
  /** 错误提示 */
  errorMessage?: string;
}

/**
 * 访谈问题列表
 *
 * 设计目标：5 分钟内完成，3 个问题
 */
export const INTERVIEW_QUESTIONS: readonly InterviewQuestion[] = [
  {
    id: "work-domain",
    question: "你的工作领域是什么？",
    placeholder: "在此输入你的工作领域描述...",
    hint: "提示：例如：互联网产品、软件开发、投资分析、数据分析...",
    hintShort: "例如：互联网产品、软件开发、投资分析...",
    minLength: 3,
    errorMessage: "请输入你的工作领域",
  },
  {
    id: "work-mode",
    question: "你的工作模式是什么？",
    placeholder: "在此输入你的工作模式...",
    hint: "提示：例如：独立工作、团队协作、远程办公...",
    hintShort: "例如：独立工作、团队协作、远程办公...",
    minLength: 3,
    errorMessage: "请输入你的工作模式",
  },
  {
    id: "main-tasks",
    question: "主要任务有哪些？",
    placeholder: "在此输入你的主要任务...",
    hint: "提示：例如：需求分析、原型设计、代码编写等，可多条...",
    hintShort: "例如：需求分析、原型设计、代码编写...",
    minLength: 3,
    errorMessage: "请至少输入一项主要任务",
  },
] as const;

/**
 * 获取问题步骤概览标签
 */
export const STEP_LABELS: readonly string[] = [
  "工作领域",
  "工作模式",
  "主要任务",
] as const;

/**
 * 获取问题索引
 */
export function getQuestionIndex(id: string): number {
  return INTERVIEW_QUESTIONS.findIndex((q) => q.id === id);
}

/**
 * 获取下一个问题 ID
 */
export function getNextQuestionId(currentId: string): string | null {
  const index = getQuestionIndex(currentId);
  if (index === -1 || index >= INTERVIEW_QUESTIONS.length - 1) {
    return null;
  }
  const nextQuestion = INTERVIEW_QUESTIONS[index + 1];
  return nextQuestion?.id ?? null;
}

/**
 * 获取上一个问题 ID
 */
export function getPreviousQuestionId(currentId: string): string | null {
  const index = getQuestionIndex(currentId);
  if (index <= 0) {
    return null;
  }
  const prevQuestion = INTERVIEW_QUESTIONS[index - 1];
  return prevQuestion?.id ?? null;
}

/**
 * 验证答案
 */
export function validateAnswer(questionId: string, answer: string): {
  valid: boolean;
  error?: string;
} {
  const question = INTERVIEW_QUESTIONS.find((q) => q.id === questionId);
  if (!question) {
    return { valid: false, error: "无效的问题" };
  }

  const trimmed = answer.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: question.errorMessage || "请输入答案" };
  }

  if (question.minLength && trimmed.length < question.minLength) {
    return {
      valid: false,
      error: `答案至少需要 ${question.minLength} 个字符`,
    };
  }

  return { valid: true };
}

/**
 * 步骤类型
 */
export type StepState = "not-started" | "in-progress" | "completed";

/**
 * 默认空答案映射
 */
export const DEFAULT_ANSWERS = Object.fromEntries(
  INTERVIEW_QUESTIONS.map((q) => [q.id, ""])
) as Record<string, string>;

/**
 * 默认步骤状态映射
 */
export const DEFAULT_STEP_STATES = INTERVIEW_QUESTIONS.reduce(
  (acc, q) => ({ ...acc, [q.id]: "not-started" as StepState }),
  {} as Record<string, StepState>
);
