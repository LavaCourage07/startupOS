/**
 * Info Query Skill Handler
 *
 * Handles information queries about projects, tasks, and team members
 */

import type { SkillContext, SkillResult } from '@/types/skill';

/**
 * Extract entity type from natural language
 */
function extractEntityType(input: string): string | null {
  const lowerInput = input.toLowerCase();

  if (lowerInput.includes('项目') || lowerInput.includes('project')) {
    return 'Project';
  }
  if (lowerInput.includes('任务') || lowerInput.includes('task')) {
    return 'Task';
  }
  if (lowerInput.includes('人员') || lowerInput.includes('成员') || lowerInput.includes('person') || lowerInput.includes('member') || lowerInput.includes('team')) {
    return 'Person';
  }
  if (lowerInput.includes('目标') || lowerInput.includes('goal')) {
    return 'Goal';
  }

  return null;
}

/**
 * Extract person name from natural language
 */
function extractPersonName(input: string): string | null {
  const match = input.match(/(?:张|李|王|刘|陈|杨|赵|黄|周)[\u4e00-\u9fa5]+/);
  return match ? match[0] : null;
}

/**
 * Execute info query skill
 */
export async function handle(context: SkillContext): Promise<SkillResult> {
  const { input, tools } = context;
  const query = input?.data as string || '';

  if (!query) {
    return {
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: '请提供查询问题',
      },
    };
  }

  try {
    // Count queries
    if (query.includes('多少') || query.includes('数量') || query.includes('how many')) {
      return await handleCountQuery(query, tools);
    }

    // Person-focused queries
    const personName = extractPersonName(query);
    if (personName) {
      return await handlePersonQuery(personName, query, tools);
    }

    // Status queries
    if (query.includes('进行中') || query.includes('完成') || query.includes('in_progress') || query.includes('done')) {
      return await handleStatusQuery(query, tools);
    }

    // General entity query
    return await handleGeneralQuery(query, tools);
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : '查询错误',
      },
    };
  }
}

/**
 * Handle count queries
 */
async function handleCountQuery(query: string, tools: SkillContext['tools']): Promise<SkillResult> {
  const entityType = extractEntityType(query);
  const where: Record<string, unknown> = {};

  // Filter by status if specified
  const lower = query.toLowerCase();
  if (lower.includes('进行中')) {
    where.status = 'in_progress';
  } else if (lower.includes('完成') || lower.includes('done')) {
    where.status = 'done';
  } else if (lower.includes('待')) {
    where.status = 'open';
  }

  let count = 0;
  let entityLabel = '';

  if (entityType === 'Task') {
    const tasks = await tools.queryEntities('Task', where);
    count = tasks.length;
    entityLabel = '任务';
  } else if (entityType === 'Project') {
    const projects = await tools.queryEntities('Project', where);
    count = projects.length;
    entityLabel = '项目';
  } else if (entityType === 'Person') {
    const persons = await tools.queryEntities('Person', where);
    count = persons.length;
    entityLabel = '人员';
  } else if (entityType === 'Goal') {
    const goals = await tools.queryEntities('Goal', where);
    count = goals.length;
    entityLabel = '目标';
  } else {
    // Default: count all tasks
    const tasks = await tools.queryEntities('Task', where);
    count = tasks.length;
    entityLabel = '任务';
  }

  return {
    success: true,
    data: {
      message: `共有 ${count} 个${entityLabel}`,
      count,
      entityType: entityLabel,
    },
  };
}

/**
 * Handle person-focused queries
 */
async function handlePersonQuery(personName: string, query: string, tools: SkillContext['tools']): Promise<SkillResult> {
  // Find the person entity
  const persons = await tools.queryEntities('Person', { name: personName });

  if (persons.length === 0) {
    return {
      success: false,
      error: {
        code: 'PERSON_NOT_FOUND',
        message: `找不到人员: ${personName}`,
      },
    };
  }

  const person = persons[0];
  const personId = person.id;

  // Check if query is about tasks
  const lower = query.toLowerCase();
  if (lower.includes('任务') || lower.includes('task')) {
    // Get all tasks
    const allTasks = await tools.queryEntities('Task', {});
    const personTasks = allTasks.filter((t: any) =>
      t.properties.assignee === personName ||
      t.properties.assignedTo === personName
    );

    return {
      success: true,
      data: {
        message: `${personName} 负责 ${personTasks.length} 个任务`,
        person: {
          id: person.id,
          name: person.properties.name,
        },
        tasks: personTasks.map((t: any) => ({
          id: t.id,
          title: t.properties.title,
          status: t.properties.status,
          priority: t.properties.priority,
        })),
      },
    };
  }

  // General person info
  return {
    success: true,
    data: {
      message: `找到人员: ${personName}`,
      person: {
        id: person.id,
        name: person.properties.name,
        role: person.properties.role,
      },
    },
  };
}

/**
 * Handle status queries
 */
async function handleStatusQuery(query: string, tools: SkillContext['tools']): Promise<SkillResult> {
  const lower = query.toLowerCase();
  let status: string | null = null;

  if (lower.includes('进行中') || lower.includes('in_progress')) {
    status = 'in_progress';
  } else if (lower.includes('完成') || lower.includes('done')) {
    status = 'done';
  } else if (lower.includes('待') || lower.includes('open')) {
    status = 'open';
  }

  if (!status) {
    return await handleGeneralQuery(query, tools);
  }

  const tasks = await tools.queryEntities('Task', { status });

  const statusLabels: Record<string, string> = {
    open: '待处理',
    in_progress: '进行中',
    blocked: '被阻塞',
    done: '已完成',
    cancelled: '已取消',
  };

  return {
    success: true,
    data: {
      message: `共有 ${tasks.length} 个${statusLabels[status] || status}任务`,
      status,
      count: tasks.length,
      tasks: tasks.map((t: any) => ({
        id: t.id,
        title: t.properties.title,
        assignee: t.properties.assignee,
      })),
    },
  };
}

/**
 * Handle general queries
 */
async function handleGeneralQuery(query: string, tools: SkillContext['tools']): Promise<SkillResult> {
  const entityType = extractEntityType(query);

  if (!entityType) {
    // Default to showing all entities summary
    const allTasks = await tools.queryEntities('Task', {});
    const allProjects = await tools.queryEntities('Project', {});
    const allPersons = await tools.queryEntities('Person', {});

    return {
      success: true,
      data: {
        message: '项目概况',
        summary: {
          tasks: allTasks.length,
          projects: allProjects.length,
          teamMembers: allPersons.length,
        },
      },
    };
  }

  const entities = await tools.queryEntities(entityType, {});

  const entityLabel = {
    Project: '项目',
    Task: '任务',
    Person: '人员',
    Goal: '目标',
  }[entityType] || entityType;

  return {
    success: true,
    data: {
      message: `找到 ${entities.length} 个${entityLabel}`,
      entityType,
      entities: entities.map((e: any) => {
        if (entityType === 'Project') {
          return { id: e.id, name: e.properties.name, description: e.properties.description };
        }
        if (entityType === 'Task') {
          return { id: e.id, title: e.properties.title, status: e.properties.status };
        }
        if (entityType === 'Person') {
          return { id: e.id, name: e.properties.name, role: e.properties.role };
        }
        if (entityType === 'Goal') {
          return { id: e.id, description: e.properties.description };
        }
        return { id: e.id, ...e.properties };
      }),
    },
  };
}
