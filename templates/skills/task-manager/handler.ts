/**
 * Task Manager Skill Handler
 *
 * Handles task management operations through natural language
 */

import type { SkillContext, SkillResult } from '@/types/skill';

/**
 * Task status enum
 */
enum TaskStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

/**
 * Task priority enum
 */
enum TaskPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * Parse task status from natural language
 */
function parseTaskStatus(input: string): TaskStatus | null {
  const lowerInput = input.toLowerCase();

  if (lowerInput.includes('进行中') || lowerInput.includes('in_progress') || lowerInput.includes('doing')) {
    return TaskStatus.IN_PROGRESS;
  }
  if (lowerInput.includes('完成') || lowerInput.includes('done') || lowerInput.includes('finished')) {
    return TaskStatus.DONE;
  }
  if (lowerInput.includes('阻塞') || lowerInput.includes('blocked')) {
    return TaskStatus.BLOCKED;
  }
  if (lowerInput.includes('取消') || lowerInput.includes('cancel')) {
    return TaskStatus.CANCELLED;
  }
  if (lowerInput.includes('待处理') || lowerInput.includes('open') || lowerInput.includes('pending') || lowerInput.includes('todo')) {
    return TaskStatus.OPEN;
  }

  return null;
}

/**
 * Parse task priority from natural language
 */
function parseTaskPriority(input: string): TaskPriority | null {
  const lowerInput = input.toLowerCase();

  if (lowerInput.includes('紧急') || lowerInput.includes('critical')) {
    return TaskPriority.CRITICAL;
  }
  if (lowerInput.includes('高') || lowerInput.includes('高优先级') || lowerInput.includes('high')) {
    return TaskPriority.HIGH;
  }
  if (lowerInput.includes('中') || lowerInput.includes('中等') || lowerInput.includes('medium')) {
    return TaskPriority.MEDIUM;
  }
  if (lowerInput.includes('低') || lowerInput.includes('low')) {
    return TaskPriority.LOW;
  }

  return null;
}

/**
 * Extract task ID from natural language
 */
function extractTaskId(input: string): string | null {
  const match = input.match(/task_[a-z0-9]+/i);
  return match ? match[0] : null;
}

/**
 * Extract task title from natural language
 */
function extractTaskTitle(input: string): string | null {
  // Extract quoted content
  const quotedMatch = input.match(/['"：](.+?)['"：]/);
  if (quotedMatch) {
    return quotedMatch[1];
  }

  // Extract from pattern like "创建一个新任务：xxx" or "create task: xxx"
  const colonMatch = input.match(/(?:任务|task)\s*[:：]\s*(.+?)(?:，|。|$)/i);
  if (colonMatch) {
    return colonMatch[1].trim();
  }

  return null;
}

/**
 * Execute task manager skill
 */
export async function handle(context: SkillContext): Promise<SkillResult> {
  const { input, tools } = context;
  const instruction = input?.data as string || '';

  if (!instruction) {
    return {
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: '请提供操作指令',
      },
    };
  }

  const lowerInput = instruction.toLowerCase();

  try {
    // Create task
    if (lowerInput.includes('创建') || lowerInput.includes('新建') || lowerInput.includes('create') || lowerInput.includes('new')) {
      return await handleCreateTask(instruction, tools);
    }

    // Update task status
    if (parseTaskStatus(instruction)) {
      return await handleUpdateStatus(instruction, tools);
    }

    // Assign task
    if (lowerInput.includes('分配') || lowerInput.includes('assign') || lowerInput.includes('指派')) {
      return await handleAssignTask(instruction, tools);
    }

    // List tasks
    if (lowerInput.includes('列出') || lowerInput.includes('显示') || lowerInput.includes('list') || lowerInput.includes('show')) {
      return await handleListTasks(instruction, tools);
    }

    // Task statistics
    if (lowerInput.includes('统计') || lowerInput.includes('分析') || lowerInput.includes('stats') || lowerInput.includes('analysis')) {
      return await handleTaskStats(tools);
    }

    // Default: list all tasks
    return await handleListTasks('', tools);
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : '执行错误',
      },
    };
  }
}

/**
 * Handle create task operation
 */
async function handleCreateTask(instruction: string, tools: SkillContext['tools']): Promise<SkillResult> {
  const title = extractTaskTitle(instruction);
  if (!title) {
    return {
      success: false,
      error: {
        code: 'INVALID_TASK_TITLE',
        message: '请提供任务标题',
      },
    };
  }

  const priority = parseTaskPriority(instruction) || TaskPriority.MEDIUM;

  const task = await tools.createEntity('Task', {
    title,
    status: TaskStatus.OPEN,
    priority,
    description: '待更新描述',
    created: new Date().toISOString(),
  });

  return {
    success: true,
    data: {
      message: `成功创建任务: ${title}`,
      task: {
        id: task.id,
        title: task.properties.title,
        status: task.properties.status,
        priority: task.properties.priority,
      },
    },
  };
}

/**
 * Handle update task status operation
 */
async function handleUpdateStatus(instruction: string, tools: SkillContext['tools']): Promise<SkillResult> {
  const taskId = extractTaskId(instruction);
  const status = parseTaskStatus(instruction);

  if (!taskId) {
    return {
      success: false,
      error: {
        code: 'INVALID_TASK_ID',
        message: '请提供任务 ID',
      },
    };
  }

  if (!status) {
    return {
      success: false,
      error: {
        code: 'INVALID_STATUS',
        message: '无法识别任务状态',
      },
    };
  }

  const task = await tools.updateEntity(taskId, { status });

  if (!task) {
    return {
      success: false,
      error: {
        code: 'TASK_NOT_FOUND',
        message: `找不到任务: ${taskId}`,
      },
    };
  }

  const statusLabels: Record<TaskStatus, string> = {
    [TaskStatus.OPEN]: '待处理',
    [TaskStatus.IN_PROGRESS]: '进行中',
    [TaskStatus.BLOCKED]: '被阻塞',
    [TaskStatus.DONE]: '已完成',
    [TaskStatus.CANCELLED]: '已取消',
  };

  return {
    success: true,
    data: {
      message: `任务 ${taskId} 状态已更新为 ${statusLabels[status]}`,
      task: {
        id: task.id,
        title: task.properties.title,
        status: task.properties.status,
      },
    },
  };
}

/**
 * Handle assign task operation
 */
async function handleAssignTask(instruction: string, tools: SkillContext['tools']): Promise<SkillResult> {
  const taskId = extractTaskId(instruction);

  if (!taskId) {
    return {
      success: false,
      error: {
        code: 'INVALID_TASK_ID',
        message: '请提供任务 ID',
      },
    };
  }

  // Extract person name
  const personMatch = instruction.match(/(?:给|assign|to)\s*(.+?)(?:，|。|$)/i);
  const personName = personMatch ? personMatch[1].trim() : null;

  if (!personName) {
    return {
      success: false,
      error: {
        code: 'INVALID_PERSON',
        message: '请提供人员名称',
      },
    };
  }

  // For now, just update the assignee field
  const task = await tools.updateEntity(taskId, { assignee: personName });

  if (!task) {
    return {
      success: false,
      error: {
        code: 'TASK_NOT_FOUND',
        message: `找不到任务: ${taskId}`,
      },
    };
  }

  return {
    success: true,
    data: {
      message: `任务 ${taskId} 已分配给 ${personName}`,
      task: {
        id: task.id,
        title: task.properties.title,
        assignee: task.properties.assignee,
      },
    },
  };
}

/**
 * Handle list tasks operation
 */
async function handleListTasks(instruction: string, tools: SkillContext['tools']): Promise<SkillResult> {
  const lowerInput = instruction.toLowerCase();
  let where: Record<string, unknown> = {};

  // Filter by status
  const status = parseTaskStatus(instruction);
  if (status) {
    where.status = status;
  }

  // Filter by priority
  const priority = parseTaskPriority(instruction);
  if (priority) {
    where.priority = priority;
  }

  const tasks = await tools.queryEntities('Task', where);

  return {
    success: true,
    data: {
      message: `找到 ${tasks.length} 个任务`,
      tasks: tasks.map((t: any) => ({
        id: t.id,
        title: t.properties.title,
        status: t.properties.status,
        priority: t.properties.priority,
        assignee: t.properties.assignee,
      })),
    },
  };
}

/**
 * Handle task statistics operation
 */
async function handleTaskStats(tools: SkillContext['tools']): Promise<SkillResult> {
  const allTasks = await tools.queryEntities('Task', {});

  const stats = {
    total: allTasks.length,
    byStatus: {} as Record<string, number>,
    byPriority: {} as Record<string, number>,
  };

  for (const task of allTasks) {
    const status = task.properties.status as string;
    const priority = task.properties.priority as string;

    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
  }

  return {
    success: true,
    data: {
      message: '任务统计',
      stats,
      summary: `项目中共有 ${stats.total} 个任务，其中 ${stats.byStatus.done || 0} 个已完成。`,
    },
  };
}
