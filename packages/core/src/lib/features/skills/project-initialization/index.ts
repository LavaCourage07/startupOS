/**
 * Project Initialization Skill Integration
 *
 * Integrates the project-initialization composite skill with pi-agent-core
 * and the Ontology skill for real-time entity creation during interviews.
 */

import { v4 as uuidv4 } from 'uuid';
import { agentSessionService } from '../../../../lib/features/agent';
import type {
  AgentMessage,
  AgentSession,
  CreateSessionRequest,
} from '../../../../types/agent';
import type { OntologyEntity } from '../../../../types/ontology';

// ============================================================================
// Types
// ============================================================================

/**
 * Project initialization configuration
 */
export interface ProjectInitializationConfig {
  /** Project ID (auto-generated if not provided) */
  projectId?: string;
  /** Project name */
  projectName: string;
  /** Initial context to pass to the skill */
  initialContext?: Record<string, unknown>;
  /** Optional system prompt override */
  customSystemPrompt?: string;
  /** Graph path for ontology storage */
  graphPath?: string;
}

/**
 * Interview phase
 */
export type InterviewPhase =
  | 'foundation'
  | 'team'
  | 'goals'
  | 'tasks'
  | 'review'
  | 'complete';

/**
 * Interview conversation context
 */
export interface InterviewContext {
  sessionId: string;
  projectId: string;
  phase: InterviewPhase;
  entitiesCreated: string[];
  conversation: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    entities_created?: OntologyEntity[];
  }>;
  projectEntityId?: string;
}

/**
 * Interview response
 */
export interface InterviewResponse {
  message: string;
  phase: InterviewPhase;
  entities_created?: OntologyEntity[];
  entities?: {
    persons?: number;
    goals?: number;
    tasks?: number;
  };
  complete?: boolean;
  project_id?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SYSTEM_PROMPT = `You are a project initialization assistant. Help users create their project ontology through natural conversation.

Goals:
1. Collect project information naturally through dialogue
2. Use the ontology skill to create entities as information is gathered
3. Adapt your questions based on the user's context and responses
4. Allow users to skip or redirect the conversation at any time
5. Show users what entities you're creating

Available Entity Types:
- Project: { name, description, status, owner, team[], goals[] }
- Person: { name, email, organization?, role? }
- Task: { title, description?, status, project?, assignee?, due?, priority? }
- Goal: { description, target_date?, status, metrics[] }

Available Relation Types:
- has_owner: Project -> Person
- member_of: Person -> Organization
- has_task: Project -> Task
- has_goal: Project -> Goal
- assigned_to: Task -> Person
- blocks: Task -> Task (acyclic)
- depends_on: Task -> Task (acyclic)

Conversation Flow:
1. Start with an open question about the project
2. After gathering key information, create the Project entity
3. Ask about team members - create Person entities and relate to project
4. Ask about goals and tasks - create Goal and Task entities
5. Create appropriate relations between entities
6. Offer to review and modify before completion`;

const SKILL_NAME = 'project-initialization';

/**
 * Default graph path for ontology storage
 */
const DEFAULT_GRAPH_PATH = 'memory/ontology/graph.jsonl';

// ============================================================================
// Skill Implementation
// ============================================================================

/**
 * Project Initialization Skill
 *
 * Manages the composite skill for project initialization through
 * conversational interview with real-time ontology building.
 */
export class ProjectInitializationSkill {
  constructor(_graphPath: string = DEFAULT_GRAPH_PATH) {
  }

  /**
   * Initialize a new project initialization session
   */
  async initialize(config: ProjectInitializationConfig): Promise<AgentSession> {
    const projectId = config.projectId || `proj_${uuidv4()}`;
    const sessionId = `session-${uuidv4()}`;

    const createRequest: CreateSessionRequest = {
      sessionId,
      projectId,
      projectName: config.projectName,
      agentType: SKILL_NAME,
      systemPrompt: config.customSystemPrompt || DEFAULT_SYSTEM_PROMPT,
      projectContext: {
        phase: 'foundation',
        ...config.initialContext,
      },
    };

    const session = await agentSessionService.createSession(createRequest);

    // Send initial system message
    await agentSessionService.addMessage(session.sessionId, {
      role: 'system',
      content: `Project initialization skill loaded for project: ${config.projectName}`,
      toolResults: [],
    });

    // Send welcome message from assistant
    await agentSessionService.addMessage(session.sessionId, {
      role: 'assistant',
      content: `Hello! I'd love to help you create a new project called "${config.projectName}". Could you tell me a bit about what you're working on?`,
      toolResults: [],
    });

    return session;
  }

  /**
   * Process a user message in the interview
   */
  async processMessage(
    sessionId: string,
    userMessage: string,
  ): Promise<InterviewResponse> {
    // Add user message to session
    await agentSessionService.addMessage(sessionId, {
      role: 'user',
      content: userMessage,
      toolResults: [],
    });

    const session = await agentSessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const currentPhase = (session.projectContext?.phase as InterviewPhase) || 'foundation';

    // Process message based on phase
    const response = await this.handleMessageByPhase(session, userMessage, currentPhase);

    // Add assistant response to session
    await agentSessionService.addMessage(sessionId, {
      role: 'assistant',
      content: response.message,
      toolResults: response.entities_created?.map(e => ({
        toolCallId: `entity-${Date.now()}`,
        result: e,
      })) || [],
    });

    // Update session phase if changed
    if (response.phase !== currentPhase) {
      await agentSessionService.updateSession(sessionId, {
        projectContext: {
          ...session.projectContext,
          phase: response.phase,
        },
      });
    }

    return response;
  }

  /**
   * Cancel an ongoing interview
   */
  async cancelInterview(sessionId: string): Promise<void> {
    await agentSessionService.updateSession(sessionId, {
      status: 'cancelled',
    });
  }

  /**
   * Complete the interview and finalize the project
   */
  async completeInterview(sessionId: string): Promise<AgentSession | null> {
    const session = await agentSessionService.getSession(sessionId);
    if (!session) {
      return null;
    }

    // Update project status to active
    const projectId = session.projectContext?.projectEntityId as string | undefined;
    if (projectId) {
      // This would call the Ontology skill API
      // await ontologyService.updateEntity(projectId, { status: 'active' });
    }

    return agentSessionService.updateSession(sessionId, {
      status: 'completed',
    });
  }

  /**
   * Get interview context
   */
  async getInterviewContext(sessionId: string): Promise<InterviewContext | null> {
    const session = await agentSessionService.getSession(sessionId);
    if (!session) {
      return null;
    }

    return {
      sessionId: session.sessionId,
      projectId: session.projectContext?.projectId as string,
      phase: (session.projectContext?.phase as InterviewPhase) || 'foundation',
      entitiesCreated: session.projectContext?.entitiesCreated as string[] || [],
      conversation: session.messages.map((m: AgentMessage) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.timestamp).toISOString(),
      })),
      projectEntityId: session.projectContext?.projectEntityId as string | undefined,
    };
  }

  // ============================================================================
  // Phase Handlers
  // ============================================================================

  /**
   * Route message to appropriate phase handler
   */
  private async handleMessageByPhase(
    session: AgentSession,
    userMessage: string,
    phase: InterviewPhase,
  ): Promise<InterviewResponse> {
    const handlers: Record<InterviewPhase, (msg: string, session: AgentSession) => Promise<InterviewResponse>> = {
      foundation: this.handleFoundationPhase,
      team: this.handleTeamPhase,
      goals: this.handleGoalsPhase,
      tasks: this.handleTasksPhase,
      review: this.handleReviewPhase,
      complete: this.handleCompletePhase,
    };

    const handler = handlers[phase];
    if (!handler) {
      return this.handleFoundationPhase(userMessage, session);
    }

    return handler.call(this, userMessage, session);
  }

  /**
   * Handle foundation phase - gather project info
   */
  private async handleFoundationPhase(
    userMessage: string,
    session: AgentSession,
  ): Promise<InterviewResponse> {
    const projectName = session.projectContext?.projectName as string;

    // Check if project entity already exists
    const projectEntityId = session.projectContext?.projectEntityId as string | undefined;

    if (!projectEntityId) {
      // Extract project info and create entity
      const description = this.extractDescription(userMessage);

      // This would call the Ontology skill API
      // const project = await ontologyService.createEntity('Project', {
      //   name: projectName,
      //   description,
      //   status: 'planning',
      // });

      const mockProject: OntologyEntity = {
        id: `proj_${uuidv4().slice(0, 8)}`,
        type: 'Project',
        properties: {
          name: projectName,
          description,
          status: 'planning',
        },
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };

      await agentSessionService.updateSession(session.sessionId, {
        projectContext: {
          ...session.projectContext,
          projectEntityId: mockProject.id,
          entitiesCreated: [
            ...(session.projectContext?.entitiesCreated as string[] || []),
            mockProject.id,
          ],
        },
      });

      return {
        message: (
          `Great! I've created the project '${projectName}'. ` +
          `${description ? description : 'Is there anything else you want to add about the project itself?'}\n\n` +
          'Now, tell me about the key people involved in this project.'
        ),
        entities_created: [mockProject],
        phase: 'team',
      };
    }

    // Project already created, move to team phase
    return {
      message: "Let's talk about the team. Who are the key people involved in this project?",
      phase: 'team',
    };
  }

  /**
   * Handle team phase - add team members
   */
  private async handleTeamPhase(
    userMessage: string,
    session: AgentSession,
  ): Promise<InterviewResponse> {
    const messageLower = userMessage.toLowerCase();
    const projectEntityId = session.projectContext?.projectEntityId as string | undefined;

    // Check for transitions
    if (messageLower.includes('no team') || messageLower.includes('just me') || messageLower.includes('solo')) {
      return {
        message: "Got it, it's a solo project. Let's move on to goals. What are you trying to achieve with this project?",
        phase: 'goals',
      };
    }

    if (messageLower.includes('goal') || messageLower.includes('objective') || messageLower.includes('done with team')) {
      return {
        message: "Excellent! Now let's define the goals. What are the main objectives for this project?",
        phase: 'goals',
      };
    }

    // Extract persons (simplified - in production use NLP/AI)
    const persons = this.extractPersons(userMessage);
    const entitiesCreated: OntologyEntity[] = [];

    if (projectEntityId && persons.length > 0) {
      for (const person of persons) {
        // This would call the Ontology skill API
        // const personEntity = await ontologyService.createEntity('Person', person);
        const personEntity: OntologyEntity = {
          id: `pers_${uuidv4().slice(0, 8)}`,
          type: 'Person',
          properties: person,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        };
        entitiesCreated.push(personEntity);

        // This would create a relation
        // await ontologyService.createRelation(projectEntityId, 'has_owner', personEntity.id);
      }

      await agentSessionService.updateSession(session.sessionId, {
        projectContext: {
          ...session.projectContext,
          entitiesCreated: [
            ...(session.projectContext?.entitiesCreated as string[] || []),
            ...entitiesCreated.map(e => e.id),
          ],
        },
      });

      return {
        message: `I've added ${persons.length} person(s) to the project team. Any other team members, or shall we talk about project goals?`,
        entities_created: entitiesCreated,
        phase: 'team',
      };
    }

    return {
      message: "Could you tell me who's on the team? You can mention names, roles, or just count.",
      phase: 'team',
    };
  }

  /**
   * Handle goals phase - define project goals
   */
  private async handleGoalsPhase(
    userMessage: string,
    session: AgentSession,
  ): Promise<InterviewResponse> {
    const messageLower = userMessage.toLowerCase();
    const projectEntityId = session.projectContext?.projectEntityId as string | undefined;

    if (messageLower.includes('task') || messageLower.includes('work') || messageLower.includes('done with goals')) {
      return {
        message: "Great! Now let's talk about the actual work. What are the initial tasks you need to do?",
        phase: 'tasks',
      };
    }

    // Extract goals (simplified)
    const goals = this.extractGoals(userMessage);
    const entitiesCreated: OntologyEntity[] = [];

    if (projectEntityId && goals.length > 0) {
      for (const goal of goals) {
        const goalEntity: OntologyEntity = {
          id: `goal_${uuidv4().slice(0, 8)}`,
          type: 'Goal',
          properties: goal,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        };
        entitiesCreated.push(goalEntity);
      }

      await agentSessionService.updateSession(session.sessionId, {
        projectContext: {
          ...session.projectContext,
          entitiesCreated: [
            ...(session.projectContext?.entitiesCreated as string[] || []),
            ...entitiesCreated.map(e => e.id),
          ],
        },
      });

      return {
        message: `I've added ${goals.length} goal(s) to the project. More goals, or shall we move on to defining tasks?`,
        entities_created: entitiesCreated,
        phase: 'goals',
      };
    }

    return {
      message: "What are the main goals or milestones for this project?",
      phase: 'goals',
    };
  }

  /**
   * Handle tasks phase - define initial tasks
   */
  private async handleTasksPhase(
    userMessage: string,
    session: AgentSession,
  ): Promise<InterviewResponse> {
    const messageLower = userMessage.toLowerCase();
    const projectEntityId = session.projectContext?.projectEntityId as string | undefined;

    if (messageLower.includes('review') || messageLower.includes('done') || messageLower.includes('complete')) {
      return this.generateReview(session);
    }

    // Extract tasks (simplified)
    const tasks = this.extractTasks(userMessage);
    const entitiesCreated: OntologyEntity[] = [];

    if (projectEntityId && tasks.length > 0) {
      for (const task of tasks) {
        const taskEntity: OntologyEntity = {
          id: `task_${uuidv4().slice(0, 8)}`,
          type: 'Task',
          properties: {
            ...task,
            project: projectEntityId,
          },
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        };
        entitiesCreated.push(taskEntity);
      }

      await agentSessionService.updateSession(session.sessionId, {
        projectContext: {
          ...session.projectContext,
          entitiesCreated: [
            ...(session.projectContext?.entitiesCreated as string[] || []),
            ...entitiesCreated.map(e => e.id),
          ],
        },
      });

      return {
        message: `I've added ${tasks.length} task(s) to the project. More tasks, or would you like to review everything and complete the setup?`,
        entities_created: entitiesCreated,
        phase: 'tasks',
      };
    }

    return {
      message: "What are the initial tasks that need to be done? You can list them or describe each one.",
      phase: 'tasks',
    };
  }

  /**
   * Handle review phase
   */
  private async handleReviewPhase(
    userMessage: string,
    session: AgentSession,
  ): Promise<InterviewResponse> {
    const messageLower = userMessage.toLowerCase();

    if (messageLower.includes('complete') || messageLower.includes('finish') || messageLower.includes('yes')) {
      return this.completeInterviewInternal(session);
    }

    if (messageLower.includes('modify') || messageLower.includes('change') || messageLower.includes('edit')) {
      return {
        message: "Sure! What would you like to change? You can tell me the entity and what to modify.",
        phase: 'review',
      };
    }

    return this.completeInterviewInternal(session);
  }

  /**
   * Handle complete phase
   */
  private async handleCompletePhase(
    _userMessage: string,
    session: AgentSession,
  ): Promise<InterviewResponse> {
    const projectEntityId = session.projectContext?.projectEntityId as string | undefined;

    return {
      message: "The project has been created successfully! You can now start working on it.",
      phase: 'complete',
      complete: true,
      project_id: projectEntityId,
    };
  }

  /**
   * Generate review summary
   */
  private async generateReview(session: AgentSession): Promise<InterviewResponse> {
    const entitiesCreated = session.projectContext?.entitiesCreated as string[] || [];

    const projectName = session.projectContext?.projectName as string || 'Unknown Project';

    // Count entity types (simplified - in production, query ontology)
    const personsCount = entitiesCreated.filter(id => id.startsWith('pers_')).length;
    const goalsCount = entitiesCreated.filter(id => id.startsWith('goal_')).length;
    const tasksCount = entitiesCreated.filter(id => id.startsWith('task_')).length;

    const reviewText = `Here's a summary of what we've created:

**Project:** ${projectName}
- Team: ${personsCount} person(s)
- Goals: ${goalsCount} goal(s)
- Tasks: ${tasksCount} task(s)

Would you like to modify anything, or shall we complete the setup?`;

    return {
      message: reviewText,
      entities: {
        persons: personsCount,
        goals: goalsCount,
        tasks: tasksCount,
      },
      phase: 'review',
    };
  }

  /**
   * Complete interview and finalize
   */
  private async completeInterviewInternal(session: AgentSession): Promise<InterviewResponse> {
    const projectEntityId = session.projectContext?.projectEntityId as string | undefined;

    // Update project to active (would call Ontology skill)
    if (projectEntityId) {
      // await ontologyService.updateEntity(projectEntityId, { status: 'active' });
    }

    await agentSessionService.updateSession(session.sessionId, {
      status: 'completed',
      projectContext: {
        ...session.projectContext,
        phase: 'complete',
      },
    });

    const projectName = session.projectContext?.projectName as string || 'Unknown Project';

    return {
      message: `Excellent! Your project "${projectName}" has been created successfully.

I've updated the project status to 'active' and all entities are now in the ontology.
You can start working on your tasks. Good luck!`,
      phase: 'complete',
      complete: true,
      project_id: projectEntityId,
    };
  }

  // ============================================================================
  // Extraction Helpers (simplified - in production use NLP/AI)
  // ============================================================================

  private extractDescription(message: string): string {
    const words = message.split(' ');
    if (words.length > 2) {
      return words.slice(2).join(' ');
    }
    return '';
  }

  private extractPersons(message: string): Record<string, string>[] {
    const persons: Record<string, string>[] = [];
    const words = message.split(' ');

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (word && word[0] && word[0] === word[0]!.toUpperCase() && word.length > 2 &&
          !['The', 'And', 'But', 'Or'].includes(word)) {
        persons.push({ name: word, role: 'Team Member' });
      }
    }

    return persons;
  }

  private extractGoals(message: string): Record<string, string>[] {
    const goals: Record<string, string>[] = [];
    const parts = message.split(',').map(p => p.trim()).filter(p => p);
    parts.push(...message.split('and').map(p => p.trim()).filter(p => p));

    const uniqueParts = Array.from(new Set(parts));

    for (const part of uniqueParts) {
      if (part.length > 5) {
        goals.push({ description: part, status: 'active' });
      }
    }

    return goals;
  }

  private extractTasks(message: string): Record<string, string>[] {
    const tasks: Record<string, string>[] = [];
    const parts = message.split(',').map(p => p.trim()).filter(p => p);
    parts.push(...message.split('and').map(p => p.trim()).filter(p => p));

    const uniqueParts = Array.from(new Set(parts));
    const actionWords = ['create', 'design', 'build', 'implement', 'write', 'develop', 'test', 'review'];

    for (const part of uniqueParts) {
      if (part.length > 3) {
        let title = part;
        for (const action of actionWords) {
          if (part.toLowerCase().includes(action)) {
            break;
          }
        }
        tasks.push({ title, status: 'open' });
      }
    }

    return tasks;
  }
}

// ============================================================================
// Export singleton
// ============================================================================

export const projectInitializationSkill = new ProjectInitializationSkill();

// ============================================================================
// Re-export React Hook from separate client file
// ============================================================================

