/**
 * Ontology Builder Service
 *
 * Handles ontology generation from interview answers and ontology editing.
 * Story 1.3: Initial Ontology Structure Generation
 */

import type {
  Domain,
  Concept,
  Instance,
  Relation,
  Ontology,
  OntologyGenerationResult,
  OntologyEditOperation,
  OntologyEditResponse,
} from '../../../types/ontology';
import type { InterviewSession } from './types';
import { jsonStore } from '../../storage/json-store';
import { v4 as uuidv4 } from 'uuid';

/**
 * Ontology Service
 */
export class OntologyService {
  private store = jsonStore;

  /**
   * Generate ontology from interview answers
   */
  async generateFromInterview(
    interview: InterviewSession,
  ): Promise<OntologyGenerationResult> {
    const startTime = Date.now();

    const answers = interview.answers;
    const projectId = interview.projectId;

    // Extract key information from interview answers
    const workDomain = this.getAnswer(answers, 'work_domain');
    const workMode = this.getAnswer(answers, 'work_mode');
    const mainTasks = this.getAnswer(answers, 'main_tasks');
    const toolsUsed = this.getAnswer(answers, 'tools_used');
    const goals = this.getAnswer(answers, 'goals');

    // Generate domain
    const domain: Domain = this.generateDomain(workDomain, workMode);

    // Generate concepts from main tasks and tools
    const concepts = this.generateConcepts(
      domain.id,
      mainTasks,
      toolsUsed,
      goals,
    );

    // Generate relations
    const relations = this.generateInitialRelations(domain, concepts);

    // Create ontology
    const ontology: Ontology = {
      id: uuidv4(),
      projectId,
      name: `${workDomain} Ontology`,
      domains: [domain],
      concepts,
      instances: [],
      relations,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save ontology
    await this.saveOntology(ontology);

    const generationTime = Date.now() - startTime;

    const result: OntologyGenerationResult = {
      ontology,
      generationTime,
      source: 'interview',
    };

    return result;
  }

  /**
   * Get ontology by ID
   */
  async getOntology(ontologyId: string): Promise<Ontology | null> {
    const data = await this.store.read<Ontology>(
      this.store.getOntologyPath(ontologyId),
    );

    return data?.data ?? null;
  }

  /**
   * Get project ontology
   */
  async getProjectOntology(projectId: string): Promise<Ontology | null> {
    const files = await this.store.listFiles(
      this.store.getOntologyPath('').replace(/[^/]*-ontology\.json$/, ''),
    );

    for (const file of files) {
      const ontologyId = file.replace('-ontology.json', '');
      const ontology = await this.getOntology(ontologyId);
      if (ontology?.projectId === projectId) {
        return ontology;
      }
    }

    return null;
  }

  /**
   * Save ontology
   */
  async saveOntology(ontology: Ontology): Promise<void> {
    const now = new Date().toISOString();

    const data = {
      version: '1.0.0',
      createdAt: ontology.createdAt,
      updatedAt: now,
      data: {
        ...ontology,
        updatedAt: now,
      },
    };

    await this.store.write(
      this.store.getOntologyPath(ontology.id),
      data,
    );
  }

  /**
   * Apply edit operations to ontology
   */
  async applyEdits(
    ontologyId: string,
    operations: OntologyEditOperation[],
  ): Promise<OntologyEditResponse> {
    const ontology = await this.getOntology(ontologyId);
    if (!ontology) {
      return {
        success: false,
        ontology: null as any,
        errors: ['Ontology not found'],
      };
    }

    const errors: string[] = [];

    for (const op of operations) {
      try {
        const result = await this.applyOperation(ontology, op);
        if (!result.success && result.errors) {
          errors.push(...result.errors);
        }
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message : 'Unknown error',
        );
      }
    }

    ontology.updatedAt = new Date().toISOString();
    await this.saveOntology(ontology);

    return {
      success: errors.length === 0,
      ontology,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Apply single operation
   */
  private async applyOperation(
    ontology: Ontology,
    operation: OntologyEditOperation,
  ): Promise<OntologyEditResponse> {
    const { type, entityType, data } = operation;

    switch (entityType) {
      case 'domain':
        return this.applyDomainOperation(ontology, type, data);
      case 'concept':
        return this.applyConceptOperation(ontology, type, data);
      case 'instance':
        return this.applyInstanceOperation(ontology, type, data);
      case 'relation':
        return this.applyRelationOperation(ontology, type, data);
      default:
        return {
          success: false,
          ontology,
          errors: [`Unknown entity type: ${entityType}`],
        };
    }
  }

  /**
   * Apply domain operation
   */
  private applyDomainOperation(
    ontology: Ontology,
    type: 'add' | 'update' | 'delete',
    data: Domain,
  ): OntologyEditResponse {
    switch (type) {
      case 'add':
        const newDomain: Domain = {
          id: data.id || uuidv4(),
          name: data.name,
          description: data.description,
          icon: data.icon,
          color: data.color,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        ontology.domains.push(newDomain);
        return { success: true, ontology };

      case 'update':
        const domainIndex = ontology.domains.findIndex((d: Domain) => d.id === data.id);
        if (domainIndex === -1) {
          return {
            success: false,
            ontology,
            errors: ['Domain not found'],
          };
        }
        ontology.domains[domainIndex] = {
          ...ontology.domains[domainIndex]!,
          ...data,
          updatedAt: new Date().toISOString(),
        };
        return { success: true, ontology };

      case 'delete':
        const deleteDomainIndex = ontology.domains.findIndex((d: Domain) => d.id === data.id);
        if (deleteDomainIndex === -1) {
          return {
            success: false,
            ontology,
            errors: ['Domain not found'],
          };
        }
        // Remove related concepts and relations
        const domainId = data.id;
        ontology.concepts = ontology.concepts.filter((c: Concept) => c.domainId !== domainId);
        ontology.relations = ontology.relations.filter((r: Relation) =>
          r.sourceId !== domainId && r.targetId !== domainId,
        );
        ontology.domains.splice(deleteDomainIndex, 1);
        return { success: true, ontology };

      default:
        return {
          success: false,
          ontology,
          errors: [`Unknown operation type: ${type}`],
        };
    }
  }

  /**
   * Apply concept operation
   */
  private applyConceptOperation(
    ontology: Ontology,
    type: 'add' | 'update' | 'delete',
    data: Concept,
  ): OntologyEditResponse {
    switch (type) {
      case 'add':
        // Validate domain exists
        if (!ontology.domains.some((d: Domain) => d.id === data.domainId)) {
          return {
            success: false,
            ontology,
            errors: ['Domain not found'],
          };
        }
        const newConcept: Concept = {
          id: data.id || uuidv4(),
          domainId: data.domainId,
          name: data.name,
          type: data.type,
          attributes: data.attributes,
          description: data.description,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        ontology.concepts.push(newConcept);
        return { success: true, ontology };

      case 'update':
        const conceptIndex = ontology.concepts.findIndex((c: Concept) => c.id === data.id);
        if (conceptIndex === -1) {
          return {
            success: false,
            ontology,
            errors: ['Concept not found'],
          };
        }
        ontology.concepts[conceptIndex] = {
          ...ontology.concepts[conceptIndex]!,
          ...data,
          updatedAt: new Date().toISOString(),
        };
        return { success: true, ontology };

      case 'delete':
        const deleteConceptIndex = ontology.concepts.findIndex((c: Concept) => c.id === data.id);
        if (deleteConceptIndex === -1) {
          return {
            success: false,
            ontology,
            errors: ['Concept not found'],
          };
        }
        // Remove related relations and instances
        const conceptId = data.id;
        ontology.instances = ontology.instances.filter((i: Instance) => i.conceptId !== conceptId);
        ontology.relations = ontology.relations.filter((r: Relation) =>
          r.sourceId !== conceptId && r.targetId !== conceptId,
        );
        ontology.concepts.splice(deleteConceptIndex, 1);
        return { success: true, ontology };

      default:
        return {
          success: false,
          ontology,
          errors: [`Unknown operation type: ${type}`],
        };
    }
  }

  /**
   * Apply instance operation
   */
  private applyInstanceOperation(
    ontology: Ontology,
    type: 'add' | 'update' | 'delete',
    data: any,
  ): OntologyEditResponse {
    switch (type) {
      case 'add':
        // Validate concept exists
        if (!ontology.concepts.some((c: Concept) => c.id === data.conceptId)) {
          return {
            success: false,
            ontology,
            errors: ['Concept not found'],
          };
        }
        ontology.instances.push({
          id: data.id || uuidv4(),
          conceptId: data.conceptId,
          data: data.data,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        return { success: true, ontology };

      case 'update':
        const instanceIndex = ontology.instances.findIndex((i: Instance) => i.id === data.id);
        if (instanceIndex === -1) {
          return {
            success: false,
            ontology,
            errors: ['Instance not found'],
          };
        }
        ontology.instances[instanceIndex] = {
          ...ontology.instances[instanceIndex]!,
          ...data,
          updatedAt: new Date().toISOString(),
        };
        return { success: true, ontology };

      case 'delete':
        const deleteIndex = ontology.instances.findIndex((i: Instance) => i.id === data.id);
        if (deleteIndex === -1) {
          return {
            success: false,
            ontology,
            errors: ['Instance not found'],
          };
        }
        ontology.instances.splice(deleteIndex, 1);
        return { success: true, ontology };

      default:
        return {
          success: false,
          ontology,
          errors: [`Unknown operation type: ${type}`],
        };
    }
  }

  /**
   * Apply relation operation
   */
  private applyRelationOperation(
    ontology: Ontology,
    type: 'add' | 'update' | 'delete',
    data: Relation,
  ): OntologyEditResponse {
    // Validate source and target exist
    const sourceExists = this.entityExists(ontology, data.sourceId);
    const targetExists = this.entityExists(ontology, data.targetId);

    if (!sourceExists) {
      return {
        success: false,
        ontology,
        errors: ['Source entity not found'],
      };
    }

    if (!targetExists) {
      return {
        success: false,
        ontology,
        errors: ['Target entity not found'],
      };
    }

    switch (type) {
      case 'add':
        ontology.relations.push({
          id: data.id || uuidv4(),
          sourceId: data.sourceId,
          targetId: data.targetId,
          type: data.type,
          metadata: data.metadata,
          createdAt: new Date().toISOString(),
        });
        return { success: true, ontology };

      case 'update':
        const relationIndex = ontology.relations.findIndex((r: Relation) => r.id === data.id);
        if (relationIndex === -1) {
          return {
            success: false,
            ontology,
            errors: ['Relation not found'],
          };
        }
        ontology.relations[relationIndex] = {
          ...ontology.relations[relationIndex]!,
          ...data,
        };
        return { success: true, ontology };

      case 'delete':
        const deleteRelationIndex = ontology.relations.findIndex((r: Relation) => r.id === data.id);
        if (deleteRelationIndex === -1) {
          return {
            success: false,
            ontology,
            errors: ['Relation not found'],
          };
        }
        ontology.relations.splice(deleteRelationIndex, 1);
        return { success: true, ontology };

      default:
        return {
          success: false,
          ontology,
          errors: [`Unknown operation type: ${type}`],
        };
    }
  }

  /**
   * Check if entity exists in ontology
   */
  private entityExists(ontology: Ontology, entityId: string): boolean {
    return (
      ontology.domains.some((d: Domain) => d.id === entityId) ||
      ontology.concepts.some((c: Concept) => c.id === entityId) ||
      ontology.instances.some((i: Instance) => i.id === entityId)
    );
  }

  /**
   * Generate domain from interview answers
   */
  private generateDomain(workDomain: string, workMode: string): Domain {
    return {
      id: uuidv4(),
      name: workDomain || 'My Project',
      description: `Project for ${workDomain} working in ${workMode} mode`,
      icon: '🔷',
      color: '#3b82f6',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate concepts from answers
   */
  private generateConcepts(
    domainId: string,
    mainTasks: string,
    toolsUsed: string | string[] | undefined,
    goals: string | undefined,
  ): Concept[] {
    const concepts: Concept[] = [];
    const now = new Date().toISOString();

    // Parse main tasks into concepts
    if (mainTasks) {
      const taskItems = this.parseTasks(mainTasks);
      taskItems.forEach((task) => {
        concepts.push({
          id: uuidv4(),
          domainId,
          name: task.name,
          type: 'task',
          attributes: {
            priority: task.priority,
            category: task.category,
          },
          description: task.description,
          createdAt: now,
          updatedAt: now,
        });
      });
    }

    // Generate tool concepts
    if (toolsUsed) {
      const tools = Array.isArray(toolsUsed) ? toolsUsed : [toolsUsed];
      tools.forEach((tool) => {
        if (tool && tool !== '其他') {
          concepts.push({
            id: uuidv4(),
            domainId,
            name: tool,
            type: 'tool',
            attributes: {
              category: 'workspace',
            },
            createdAt: now,
            updatedAt: now,
          });
        }
      });
    }

    // Generate goal concepts
    if (goals) {
      const goalItems = this.parseGoals(goals);
      goalItems.forEach((goal) => {
        concepts.push({
          id: uuidv4(),
          domainId,
          name: goal.name,
          type: 'goal',
          attributes: {
            status: 'pending',
          },
          description: goal.description,
          createdAt: now,
          updatedAt: now,
        });
      });
    }

    // Ensure minimum 2 concepts
    if (concepts.length < 2) {
      concepts.push(
        {
          id: uuidv4(),
          domainId,
          name: '日常工作',
          type: 'routine',
          attributes: {},
          description: '日常工作任务和流程',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: uuidv4(),
          domainId,
          name: '项目管理',
          type: 'management',
          attributes: {},
          description: '项目相关的管理活动',
          createdAt: now,
          updatedAt: now,
        },
      );
    }

    return concepts;
  }

  /**
   * Generate initial relations
   */
  private generateInitialRelations(
    domain: Domain,
    concepts: Concept[],
  ): Relation[] {
    const relations: Relation[] = [];

    // Domain contains all concepts
    concepts.forEach((concept) => {
      relations.push({
        id: uuidv4(),
        sourceId: domain.id,
        targetId: concept.id,
        type: 'contains',
        createdAt: new Date().toISOString(),
      });
    });

    // Generate task dependencies if tasks exist
    const taskConcepts = concepts.filter(c => c.type === 'task');
    for (let i = 0; i < taskConcepts.length - 1; i++) {
      relations.push({
        id: uuidv4(),
        sourceId: taskConcepts[i]!.id,
        targetId: taskConcepts[i + 1]!.id,
        type: 'dependency',
        createdAt: new Date().toISOString(),
      });
    }

    return relations;
  }

  /**
   * Parse tasks from input string
   */
  private parseTasks(input: string): Array<{
    name: string;
    priority: string;
    category: string;
    description: string;
  }> {
    // Simple parsing - split by newlines or commas
    const lines = input
      .split(/[\n,;，；]/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    return lines.slice(0, 5).map((line, index) => ({
      name: line.substring(0, 30),
      priority: index === 0 ? 'high' : 'medium',
      category: 'general',
      description: line,
    }));
  }

  /**
   * Parse goals from input string
   */
  private parseGoals(input: string): Array<{
    name: string;
    description: string;
  }> {
    const lines = input
      .split(/[\n,;，；]/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    return lines.slice(0, 3).map(line => ({
      name: line.substring(0, 20),
      description: line,
    }));
  }

  /**
   * Get answer from interview answers
   */
  private getAnswer(
    answers: Record<string, any>,
    questionId: string,
  ): string {
    const answerData = answers[questionId];
    if (!answerData) return '';

    const answer = answerData.answer;
    return Array.isArray(answer) ? answer.join(', ') : (answer || '');
  }
}

/**
 * Export singleton instance
 */
export const ontologyService = new OntologyService();
