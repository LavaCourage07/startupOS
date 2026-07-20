export interface InterviewAnswer {
  questionId: string;
  question: string;
  answer: string;
  timestamp: number;
}

export interface OntologyNode {
  id: string;
  name: string;
  type: "entity" | "class" | "property" | "relationship" | "rule";
  description?: string;
  children?: OntologyNode[];
}

export interface OntologyModel {
  id: string;
  name: string;
  description: string;
  nodes: OntologyNode[];
  createdAt: number;
}

export interface InterviewStep {
  id: string;
  question: string;
  placeholder?: string;
  inputType?: "text" | "textarea" | "select";
  options?: string[];
}

export interface InterviewFlow {
  steps: InterviewStep[];
  totalSteps: number;
}

export type InterviewState =
  | "welcome"
  | "interviewing"
  | "generating"
  | "preview"
  | "editing"
  | "completed";

export interface InterviewData {
  projectName: string;
  projectType: string;
  projectDescription: string;
  targetUsers: string;
  mainFeatures: string;
}

/**
 * 访谈完成结果
 */
export interface InterviewResult {
	/**
	 * 项目名称
	 */
	projectName: string;

	/**
	 * 项目领域
	 */
	domain: string;

	/**
	 * 工作模式
	 */
	mode: string;

	/**
	 * 主要任务
	 */
	tasks: string;

	/**
	 * 识别出的概念（如果有）
	 */
	concepts?: Concept[];

	/**
	 * 生成的本体数据
	 */
	ontology?: OntologyModel;

	/**
	 * 原始答案数据
	 */
	answers?: InterviewAnswer[];
}

/**
 * 概念提取结果
 */
export interface Concept {
	/**
	 * 概念名称
	 */
	name: string;

	/**
	 * 概念类型
	 */
	type: "entity" | "class" | "property" | "relationship";

	/**
	 * 概念描述
	 */
	description?: string;

	/**
	 * 置信度
	 */
	confidence?: number;
}

/**
 * Interview session status
 */
export type InterviewStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

/**
 * Interview session
 */
export interface Interview {
  id: string;
  projectId: string;
  status: InterviewStatus;
  currentQuestionIndex: number;
  answers: Record<string, string>;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  skipped?: boolean;
}

/**
 * Interview progress
 */
export interface InterviewProgress {
  currentQuestion: number;
  totalQuestions: number;
  percentage: number;
  canGoBack: boolean;
  canGoNext: boolean;
}

/**
 * Default interview questions
 */
export const DEFAULT_INTERVIEW_QUESTIONS: InterviewStep[] = [
  {
    id: 'work_domain',
    question: '你的工作领域是什么？',
    placeholder: '例如：软件开发、产品设计、数据分析...',
    inputType: 'textarea',
  },
  {
    id: 'work_mode',
    question: '你的工作模式是什么？',
    placeholder: '例如：独立工作、团队协作、远程办公...',
    inputType: 'textarea',
  },
  {
    id: 'main_tasks',
    question: '主要任务有哪些？',
    placeholder: '例如：需求分析、代码开发、测试验证...',
    inputType: 'textarea',
  },
];
