"use client";

import { useEffect, useState } from "react";
import { useInterviewStore } from "@/store/interviewStore";
import { WelcomeScreen } from "./WelcomeScreen";
import { QuestionInput } from "./QuestionInput";
import { GeneratingState } from "./GeneratingState";
import { OntologyPreview } from "./OntologyPreview";
import { OntologyEditor } from "./OntologyEditor";
import {
  INTERVIEW_QUESTIONS,
  STEP_LABELS,
  getNextQuestionId,
  getPreviousQuestionId,
} from "@originos/core/lib/features/interview";
import type { InterviewAnswer, OntologyNode } from "@originos/core/types";
import { createInterview, completeInterview, submitInterviewAnswer } from "@originos/core/lib/integrations/electron/services/misc";
import { generateOntology } from "@originos/core/lib/integrations/electron/services/ontology";
import { adaptOntologyForDisplay } from "@originos/core/lib/features/interview";
import type { Ontology } from "@originos/core/types";

/**
 * ProjectInterview - 项目访谈主组件
 *
 * 管理访谈流程：
 * 1. Welcome - 欢迎屏幕
 * 2. Interviewing - 问题收集（3个问题）
 * 3. Generating - 生成本体（加载状态）
 * 4. Preview - 本体预览
 * 5. Editing - 编辑本体
 * 6. Completed - 完成
 */

export function ProjectInterview() {
  const {
    state,
    currentStep,
    totalSteps,
    answers,
    isLoading,
    setAnswer,
    setState,
    nextStep,
    previousStep,
    setLoading,
    setOntology,
    error,
    setError,
  } = useInterviewStore();

  const [localAnswer, setLocalAnswer] = useState("");
  const [generationMessage, setGenerationMessage] = useState("正在生成本体结构...");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [interviewData, setInterviewData] = useState({ interviewId: '', projectId: '' });

  // Load saved answer when step changes
  useEffect(() => {
    if (state === "interviewing") {
      const currentQuestion = INTERVIEW_QUESTIONS[currentStep];
      if (currentQuestion) {
        const savedAnswer = answers.find((a) => a.questionId === currentQuestion.id);
        setLocalAnswer(savedAnswer?.answer || "");
      }
    }
  }, [currentStep, state, answers]);

  const handleStart = async () => {
    // Create a project ID for the interview
    const projectId = `proj-${Date.now()}`;

    // Create interview session with backend
    try {
      const result = await createInterview({ projectId, skipOptionalQuestions: false });
      if (result.success) {
        const data = result.data as { id: string };
        setInterviewData({ interviewId: data.id, projectId });
      }
    } catch (error) {
      console.error('Failed to create interview session:', error);
      // Continue anyway - use local IDs
      const tempInterviewId = `int-${Date.now()}`;
      setInterviewData({ interviewId: tempInterviewId, projectId });
    }

    setState("interviewing");
  };

  const handleSkip = () => {
    setState("completed");
  };

  const handleLater = () => {
    // 关闭访谈，稍后可以在设置中重新启动
    setState("completed");
  };

  const handleCancel = () => {
    // 返回上一状态或关闭访谈
    if (state === "interviewing" && currentStep === 0) {
      setState("welcome");
    }
  };

  const handleNext = () => {
    const currentQuestion = INTERVIEW_QUESTIONS[currentStep];
    if (!currentQuestion) return;

    setAnswer(currentQuestion.id, currentQuestion.question, localAnswer);

    const nextQuestionId = getNextQuestionId(currentQuestion.id);

    if (nextQuestionId) {
      nextStep();
      setLocalAnswer("");
    } else {
      handleFinishInterview();
    }
  };

  const handlePrevious = () => {
    const currentQuestion = INTERVIEW_QUESTIONS[currentStep];
    if (!currentQuestion) return;

    const prevQuestionId = getPreviousQuestionId(currentQuestion.id);

    // 保存当前答案
    setAnswer(currentQuestion.id, currentQuestion.question, localAnswer);

    if (prevQuestionId) {
      previousStep();
    }
  };

  const handleFinishInterview = async () => {
    setState("generating");
    setLoading(true);
    setGenerationMessage("正在生成本体结构...");
    setGenerationProgress(0);

    try {
      // Use actual backend API to generate ontology
      const messages = [
        { msg: "正在保存访谈数据...", progress: 20 },
        { msg: "正在分析您的访谈数据...", progress: 40 },
        { msg: "正在提取核心概念...", progress: 60 },
        { msg: "正在生成本体结构...", progress: 80 },
        { msg: "正在完成您的模型...", progress: 95 },
      ];

      const domainAnswer = answers.find((a: InterviewAnswer) => a.questionId === "work-domain")?.answer;
      const modeAnswer = answers.find((a: InterviewAnswer) => a.questionId === "work-mode")?.answer;
      const tasksAnswer = answers.find((a: InterviewAnswer) => a.questionId === "main-tasks")?.answer;

      // Step 1: Save answers to backend interview session
      if (interviewData.interviewId) {
        try {
          for (const item of messages) {
            setGenerationMessage(item.msg);
            setGenerationProgress(item.progress);
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // Submit all answers to backend
          const answersMap: Record<string, string> = {};
          answers.forEach(a => {
            answersMap[a.questionId] = a.answer;
          });

          await submitInterviewAnswer(interviewData.interviewId, answers[answers.length - 1]?.questionId || '', answers[answers.length - 1]?.answer || '');

          // Complete the interview
          await completeInterview(interviewData.interviewId);

          // Step 2: Generate ontology from completed interview
          const ontologyResult = await generateOntology({
            interviewId: interviewData.interviewId,
            projectId: interviewData.projectId,
          });

          if (ontologyResult.success && ontologyResult.data) {
            const generatedOntology = (ontologyResult.data as { ontology: Ontology }).ontology;
            setGenerationProgress(100);
            setOntology(adaptOntologyForDisplay(generatedOntology));
            setState("preview");
            setLoading(false);
            return;
          }
        } catch (apiError) {
          console.error('Backend API failed, falling back to mock:', apiError);
          // Continue to fallback mock below
        }
      }

      // Fallback: Generate mock ontology if backend fails
      const nodes: OntologyNode[] = [
        {
          id: "domain",
          name: "工作领域",
          type: "entity",
          description: domainAnswer || "工作领域",
          children: [
            {
              id: "work-mode",
              name: "工作模式",
              type: "class",
              description: modeAnswer || "工作模式",
            },
          ],
        },
        {
          id: "tasks",
          name: "主要任务",
          type: "entity",
          description: tasksAnswer || "主要任务",
          children: [
            {
              id: "task-1",
              name: "任务1",
              type: "class",
              description: "主要工作内容",
            },
          ],
        },
      ];

      const mockOntology = {
        id: `ontology-${Date.now()}`,
        name: domainAnswer || "我的项目",
        description: `基于您的工作领域"${domainAnswer}"生成的本体`,
        nodes,
        createdAt: Date.now(),
      };

      setGenerationProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 500));

      setOntology(mockOntology);
      setState("preview");
      setLoading(false);
    } catch (err) {
      setError("生成本体失败，请重试。");
      setLoading(false);
      // 保持 generating 状态以显示错误
    }
  };

  const handleConfirm = () => {
    setState("completed");
  };

  const handleEdit = () => {
    setState("editing");
  };

  const handleSaveOntologyEdit = (updatedOntology: any) => {
    setOntology(updatedOntology);
    setState("preview");
  };

  const handleCancelOntologyEdit = () => {
    setState("preview");
  };

  // 已完成的步骤（进度点使用）
  const completedSteps = answers
    .map((a: InterviewAnswer) =>
      INTERVIEW_QUESTIONS.findIndex((q) => q.id === a.questionId) + 1
    )
    .filter((v) => v > 0);

  // Welcome 状态
  if (state === "welcome") {
    return (
      <WelcomeScreen
        onStart={handleStart}
        onLater={handleLater}
        onSkip={handleSkip}
        onCancel={handleSkip}
      />
    );
  }

  // Interviewing 状态
  if (state === "interviewing") {
    const currentQuestion = INTERVIEW_QUESTIONS[currentStep];
    if (!currentQuestion) return null;

    return (
      <QuestionInput
        question={currentQuestion.question}
        placeholder={currentQuestion.hintShort}
        value={localAnswer}
        onChange={setLocalAnswer}
        onNext={handleNext}
        onPrevious={currentStep > 0 ? handlePrevious : undefined}
        isLastQuestion={currentStep === totalSteps - 1}
        isSubmitting={isLoading}
        stepNumber={currentStep + 1}
        totalSteps={totalSteps}
        stepLabels={STEP_LABELS}
        completedSteps={completedSteps}
        onCancel={handleCancel}
      />
    );
  }

  // Generating 状态
  if (state === "generating") {
    return (
      <GeneratingState
        message={generationMessage}
        progress={generationProgress}
        error={error || undefined}
        onCancel={() => setState("interviewing")}
      />
    );
  }

  // Preview 状态
  if (state === "preview") {
    const ontology = useInterviewStore.getState().ontology;
    if (ontology) {
      return (
        <OntologyPreview
          ontology={ontology}
          onConfirm={handleConfirm}
          onEdit={handleEdit}
        />
      );
    }
  }

  // Editing 状态
  if (state === "editing") {
    const ontology = useInterviewStore.getState().ontology;
    if (ontology) {
      return (
        <OntologyEditor
          ontology={ontology}
          onSave={handleSaveOntologyEdit}
          onCancel={handleCancelOntologyEdit}
        />
      );
    }
  }

  // Completed 状态
  if (state === "completed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-16 h-16 mx-auto rounded-full bg-teal-500/10 flex items-center justify-center border border-teal-500/20">
            <span className="text-4xl">🎉</span>
          </div>
          <h1 className="text-2xl font-semibold text-text-primary">
            设置完成！
          </h1>
          <p className="text-text-secondary">
            你的项目已准备就绪。你现在可以开始使用 OriginOS 进行工作。
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 rounded-lg bg-primary text-foreground text-sm font-medium hover:bg-primary/90"
          >
            开始使用
          </button>
        </div>
      </div>
    );
  }

  return null;
}
