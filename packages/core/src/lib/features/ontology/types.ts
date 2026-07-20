/**
 * Interview Module Types
 * Story 1.2: Structured Interview Question Collection
 */

/**
 * Question type for interview
 */
export type QuestionType = 'text' | 'select' | 'multiselect' | 'textarea';

/**
 * Single interview question
 */
export interface InterviewQuestion {
  id: string;
  question: string;
  type: QuestionType;
  options?: string[];
  required: boolean;
  placeholder?: string;
  helpText?: string;
}

/**
 * Answer to a question
 */
export interface QuestionAnswer {
  questionId: string;
  answer: string | string[];
  timestamp: number;
}

/**
 * Interview session status
 */
export type InterviewStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

/**
 * Interview session
 */
export interface InterviewSession {
  id: string;
  projectId: string;
  questions: InterviewQuestion[];
  answers: Record<string, QuestionAnswer>;
  currentQuestionIndex: number;
  status: InterviewStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  completedAt?: string; // ISO 8601
}

/**
 * Interview session with metadata for storage
 */
export interface InterviewSessionData {
  version: string;
  createdAt: string;
  updatedAt: string;
  data: InterviewSession;
}

/**
 * Core interview questions (required)
 */
export const CORE_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'work_domain',
    question: '你的工作领域是什么？',
    type: 'text',
    required: true,
    placeholder: '例如：软件开发、市场营销、产品设计...',
    helpText: '这将帮助系统理解您的工作背景'
  },
  {
    id: 'work_mode',
    question: '你的工作模式是什么？',
    type: 'select',
    required: true,
    options: [
      '全职工作',
      '自由职业',
      '远程工作',
      '混合模式',
      '创业',
      '其他'
    ],
    helpText: '选择最符合您当前工作状态的选项'
  },
  {
    id: 'main_tasks',
    question: '主要任务有哪些？',
    type: 'textarea',
    required: true,
    placeholder: '请列出您日常的主要工作任务...',
    helpText: '详细描述可以帮助系统更好地理解您的需求'
  }
];

/**
 * Additional optional questions
 */
export const OPTIONAL_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'tools_used',
    question: '你经常使用的工具或软件有哪些？',
    type: 'multiselect',
    required: false,
    options: [
      '代码编辑器（VS Code、IntelliJ 等）',
      '项目管理工具（Jira、Trello 等）',
      '设计工具（Figma、Sketch 等）',
      '办公软件（Office、Google Docs 等）',
      '沟通工具（Slack、Teams 等）',
      '其他'
    ]
  },
  {
    id: 'team_size',
    question: '你的团队规模是？',
    type: 'select',
    required: false,
    options: ['个人', '2-5人', '6-20人', '21-50人', '50人以上']
  },
  {
    id: 'goals',
    question: '你希望 OriginOS 帮助你解决什么问题？',
    type: 'textarea',
    required: false,
    placeholder: '描述您希望通过 OriginOS 达成的目标...',
    helpText: '这将帮助我们为您提供更好的个性化体验'
  }
];

/**
 * Get all interview questions (core + optional)
 */
export function getAllInterviewQuestions(): InterviewQuestion[] {
  return [...CORE_QUESTIONS, ...OPTIONAL_QUESTIONS];
}

/**
 * Get core questions only
 */
export function getCoreQuestions(): InterviewQuestion[] {
  return [...CORE_QUESTIONS];
}
