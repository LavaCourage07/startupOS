import { create } from "zustand";
import type {
  InterviewAnswer,
  InterviewData,
  InterviewState,
  OntologyModel,
} from "@originos/core/types";

interface InterviewStore {
  // Current state of the interview
  state: InterviewState;

  // Progress tracking
  currentStep: number;
  totalSteps: number;
  answers: InterviewAnswer[];

  // Interview data
  interviewData: Partial<InterviewData>;

  // Ontology data
  ontology: OntologyModel | null;

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Actions
  setState: (state: InterviewState) => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;

  setAnswer: (questionId: string, question: string, answer: string) => void;
  updateAnswer: (questionId: string, answer: string) => void;

  setInterviewData: (data: Partial<InterviewData>) => void;
  setOntology: (ontology: OntologyModel) => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  reset: () => void;
}

const TOTAL_STEPS = 3;

const INITIAL_STATE: Omit<
  InterviewStore,
  | "setState"
  | "setStep"
  | "nextStep"
  | "previousStep"
  | "setAnswer"
  | "updateAnswer"
  | "setInterviewData"
  | "setOntology"
  | "setLoading"
  | "setError"
  | "reset"
> = {
  state: "welcome",
  currentStep: 0,
  totalSteps: TOTAL_STEPS,
  answers: [],
  interviewData: {},
  ontology: null,
  isLoading: false,
  error: null,
};

export const useInterviewStore = create<InterviewStore>((set) => ({
  ...INITIAL_STATE,

  setState: (state) => set({ state }),

  setStep: (step) => set({ currentStep: step }),

  nextStep: () =>
    set((state) => ({
      currentStep: Math.min(state.currentStep + 1, state.totalSteps - 1),
    })),

  previousStep: () =>
    set((state) => ({
      currentStep: Math.max(state.currentStep - 1, 0),
    })),

  setAnswer: (questionId, question, answer) =>
    set((state) => ({
      answers: [
        ...state.answers.filter((a) => a.questionId !== questionId),
        { questionId, question, answer, timestamp: Date.now() },
      ],
    })),

  updateAnswer: (questionId, answer) =>
    set((state) => ({
      answers: state.answers.map((a) =>
        a.questionId === questionId ? { ...a, answer } : a
      ),
    })),

  setInterviewData: (data) =>
    set((state) => ({
      interviewData: { ...state.interviewData, ...data },
    })),

  setOntology: (ontology) => set({ ontology }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () => set(INITIAL_STATE),
}));
