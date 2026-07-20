import type {
  ApiResponse,
  CreateInterviewRequest,
  GenerateOntologyRequest,
  CompleteInterviewRequest,
} from "@/types/api";
import type { OntologyModel } from "@/types/interview";
import { createInterview, completeInterview, submitInterviewAnswer } from "../../integrations/electron/services/misc";
import { confirmOntology, generateOntology, getOntology } from "../../integrations/electron/services/ontology";

// Interview API endpoints
export const interviewApi = {
  /**
   * Create a new interview session
   */
  async createInterview(
    request: CreateInterviewRequest
  ): Promise<ApiResponse<{ id: string }>> {
    return createInterview(request) as Promise<ApiResponse<{ id: string }>>;
  },

  /**
   * Submit an answer for a specific question
   */
  async submitAnswer(
    interviewId: string,
    questionId: string,
    answer: unknown
  ): Promise<ApiResponse<unknown>> {
    return submitInterviewAnswer(interviewId, questionId, String(answer)) as Promise<ApiResponse<unknown>>;
  },

  /**
   * Complete the interview and trigger ontology generation
   */
  async completeInterview(
    request: CompleteInterviewRequest
  ): Promise<ApiResponse<unknown>> {
    return completeInterview(request.interviewId) as Promise<ApiResponse<unknown>>;
  },

  /**
   * Generate ontology from a completed interview
   */
  async generateOntology(
    request: GenerateOntologyRequest
  ): Promise<ApiResponse<{
    ontology: OntologyModel;
    generationTime: number;
    source: string;
  }>> {
    return generateOntology(request) as Promise<ApiResponse<{
      ontology: OntologyModel;
      generationTime: number;
      source: string;
    }>>;
  },

  /**
   * Confirm and save the generated ontology
   */
  async confirmOntology(
    ontologyId: string,
    confirmed: boolean
  ): Promise<ApiResponse<unknown>> {
    return confirmOntology(ontologyId, confirmed) as Promise<ApiResponse<unknown>>;
  },

  /**
   * Get ontology details
   */
  async getOntology(ontologyId: string): Promise<ApiResponse<{ ontology: OntologyModel }>> {
    return getOntology(ontologyId) as Promise<ApiResponse<{ ontology: OntologyModel }>>;
  },
};
