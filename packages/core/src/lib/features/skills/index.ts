/**
 * Skills Feature Module
 *
 * Public API for skill-related functionality
 */

export { skillExecutor } from './executor';
export { agentDecisionMaker, detectIntent } from './decision';
export { skillRegistry } from './registry';
export {
  listSkills,
  refreshSkills,
  getSkillContent,
  getSkillDetail,
  completeSkillExecution,
  getSkillExecutionTimeline,
  listSkillSessions,
  sendSkillExecutionMessage,
  streamSkillExecutionMessage,
  SkillServiceError,
  startSkillExecution,
} from './service';
export type {
  SkillContentRequest,
  SkillContentResponse,
  SkillDetailRequest,
  SkillDetailResponse,
  SkillExecutionCompleteRequest,
  SkillExecutionCompleteResponse,
  SkillExecutionMessageRequest,
  SkillExecutionMessageResponse,
  SkillExecutionStartRequest,
  SkillExecutionStartResponse,
  SkillExecutionStreamEvent,
  SkillExecutionStreamEventType,
  SkillExecutionStreamRequest,
  SkillExecutionTimelineItem,
  SkillExecutionTimelineRequest,
  SkillExecutionTimelineResponse,
  SkillListItem,
  SkillListRequest,
  SkillListResponse,
  SkillSessionsRequest,
  SkillSessionsResponse,
  SkillSource,
} from './service';
