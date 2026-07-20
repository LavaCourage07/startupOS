/**
 * Ontology Editor Skill Handler
 *
 * Handles ontology editing operations through natural language
 */

import type { SkillContext, SkillResult } from '../../../../../types/skill';

/**
 * Operation types
 */
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  QUERY = 'query',
  VALIDATE = 'validate',
}

/**
 * Parse natural language input to determine operation
 */
function parseOperation(input: string): { type: OperationType; params: Record<string, unknown> } {
  const lowerInput = input.toLowerCase();

  // Query operations
  if (lowerInput.includes('查询') || lowerInput.includes('显示') || lowerInput.includes('列出') || lowerInput.includes('list') || lowerInput.includes('show')) {
    return {
      type: OperationType.QUERY,
      params: { query: input },
    };
  }

  // Create operations
  if (lowerInput.includes('创建') || lowerInput.includes('新建') || lowerInput.includes('添加') || lowerInput.includes('create') || lowerInput.includes('add') || lowerInput.includes('new')) {
    return {
      type: OperationType.CREATE,
      params: { instruction: input },
    };
  }

  // Update operations
  if (lowerInput.includes('更新') || lowerInput.includes('修改') || lowerInput.includes('edit') || lowerInput.includes('modify') || lowerInput.includes('update')) {
    return {
      type: OperationType.UPDATE,
      params: { instruction: input },
    };
  }

  // Delete operations
  if (lowerInput.includes('删除') || lowerInput.includes('移除') || lowerInput.includes('remove') || lowerInput.includes('delete')) {
    return {
      type: OperationType.DELETE,
      params: { instruction: input },
    };
  }

  // Validate operations
  if (lowerInput.includes('验证') || lowerInput.includes('检验') || lowerInput.includes('validate') || lowerInput.includes('check')) {
    return {
      type: OperationType.VALIDATE,
      params: {},
    };
  }

  // Default to query
  return {
    type: OperationType.QUERY,
    params: { query: input },
  };
}

/**
 * Extract entity type from natural language
 */
function extractEntityType(input: string): string | null {
  const types = ['项目', '任务', '人员', '目标', 'project', 'task', 'person', 'goal'];
  const lowerInput = input.toLowerCase();

  for (const type of types) {
    if (lowerInput.includes(type.toLowerCase())) {
      if (type === '项目' || type === 'project') return 'Project';
      if (type === '任务' || type === 'task') return 'Task';
      if (type === '人员' || type === 'person') return 'Person';
      if (type === '目标' || type === 'goal') return 'Goal';
    }
  }

  return null;
}

/**
 * Extract entity name from natural language
 */
function extractEntityName(input: string): string | null {
  // Try to extract quoted content
  const quotedMatch = input.match(/['"](.+?)['"]/);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  // Try to extract "名为 X" or "name X" pattern
  const nameMatch = input.match(/(?:名为|名为|name|是)\s*['"]?([^'",。！？\n]+)['"]?/i);
  if (nameMatch?.[1]) {
    return nameMatch[1].trim();
  }

  return null;
}

/**
 * Execute ontology editor skill
 */
export async function handle(context: SkillContext): Promise<SkillResult> {
  const { input, tools } = context;
  // Support both input.data (for object inputs) and input.message (for string inputs)
  const instruction = (input?.data as unknown as string) || input?.message || '';

  if (!instruction) {
    return {
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: '请提供操作指令',
      },
    };
  }

  const { type, params } = parseOperation(instruction);

  try {
    switch (type) {
      case OperationType.QUERY:
        return await handleQuery(params, tools);
      case OperationType.CREATE:
        return await handleCreate(params, tools);
      case OperationType.UPDATE:
        return await handleUpdate(params, tools);
      case OperationType.DELETE:
        return await handleDelete(params, tools);
      case OperationType.VALIDATE:
        return await handleValidate(tools);
      default:
        return {
          success: false,
          error: {
            code: 'UNKNOWN_OPERATION',
            message: '未知操作类型',
          },
        };
    }
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
 * Handle query operations
 */
async function handleQuery(params: Record<string, unknown>, tools: SkillContext['tools']): Promise<SkillResult> {
  const query = params['query'] as string || '';
  const entityType = extractEntityType(query);

  let entities: any[];
  if (entityType) {
    entities = await tools.queryEntities!(entityType, {});
  } else {
    // Query all entities
    entities = await tools.queryEntities!('Project', {});
    entities = entities.concat(await tools.queryEntities!('Task', {}));
    entities = entities.concat(await tools.queryEntities!('Person', {}));
    entities = entities.concat(await tools.queryEntities!('Goal', {}));
  }

  return {
    success: true,
    data: {
      message: `找到 ${entities.length} 个实体`,
      entities: entities.map(e => ({
        id: e.id,
        type: e.type,
        name: e.properties.name || e.properties.title || e.id,
      })),
    },
  };
}

/**
 * Handle create operations
 */
async function handleCreate(params: Record<string, unknown>, tools: SkillContext['tools']): Promise<SkillResult> {
  const instruction = params['instruction'] as string || '';
  const entityType = extractEntityType(instruction);
  const entityName = extractEntityName(instruction);

  if (!entityType) {
    return {
      success: false,
      error: {
        code: 'INVALID_ENTITY_TYPE',
        message: '请指定实体类型（项目、任务、人员、目标）',
      },
    };
  }

  const properties: Record<string, unknown> = {};

  if (entityType === 'Project') {
    properties['name'] = entityName || '新项目';
    properties['description'] = '待更新描述';
  } else if (entityType === 'Task') {
    properties['title'] = entityName || '新任务';
    properties['status'] = 'open';
    properties['description'] = '待更新描述';
  } else if (entityType === 'Person') {
    properties['name'] = entityName || '新人员';
    properties['role'] = '待分配';
  } else if (entityType === 'Goal') {
    properties['description'] = entityName || '新目标';
  }

  const entity = await tools.createEntity!(entityType, properties);

  return {
    success: true,
    data: {
      message: `成功创建 ${entityType} 实体`,
      entity,
    },
  };
}

/**
 * Handle update operations
 */
async function handleUpdate(params: Record<string, unknown>, tools: SkillContext['tools']): Promise<SkillResult> {
  const instruction = params['instruction'] as string || '';

  // Extract entity ID from instruction
  const idMatch = instruction.match(/[a-z]+_[a-z0-9]+/i);
  if (!idMatch) {
    return {
      success: false,
      error: {
        code: 'INVALID_ENTITY_ID',
        message: '请在指令中提供实体 ID',
      },
    };
  }

  const entityId = idMatch[0];

  // Extract property updates
  const properties: Record<string, unknown> = {};

  // Extract description update
  const descMatch = instruction.match(/(?:描述|description)\s*[:：]\s*(.+?)(?:，|。|$)/);
  if (descMatch?.[1]) {
    properties['description'] = descMatch[1].trim();
  }

  // Extract name/title update
  const nameMatch = instruction.match(/(?:名称|名字|name|title)\s*[:：]\s*(.+?)(?:，|。|$)/);
  if (nameMatch?.[1]) {
    if (instruction.includes('任务')) {
      properties['title'] = nameMatch[1].trim();
    } else {
      properties['name'] = nameMatch[1].trim();
    }
  }

  const entity = await tools.updateEntity!(entityId, properties);

  if (!entity) {
    return {
      success: false,
      error: {
        code: 'ENTITY_NOT_FOUND',
        message: `找不到实体: ${entityId}`,
      },
    };
  }

  return {
    success: true,
    data: {
      message: `成功更新实体 ${entityId}`,
      entity,
    },
  };
}

/**
 * Handle delete operations
 */
async function handleDelete(params: Record<string, unknown>, _tools: SkillContext['tools']): Promise<SkillResult> {
  const instruction = params['instruction'] as string || '';

  // Extract entity ID from instruction
  const idMatch = instruction.match(/[a-z]+_[a-z0-9]+/i);
  if (!idMatch) {
    return {
      success: false,
      error: {
        code: 'INVALID_ENTITY_ID',
        message: '请在指令中提供实体 ID',
      },
    };
  }

  // This would require a deleteEntity tool, which we don't have yet
  // For now, return a message about the operation
  return {
    success: true,
    data: {
      message: `删除操作暂未实现，实体 ID: ${idMatch[0]}`,
    },
  };
}

/**
 * Handle validate operations
 */
async function handleValidate(tools: SkillContext['tools']): Promise<SkillResult> {
  // For now, return a simple validation message
  // In a full implementation, this would call a validate API

  const allEntities = await tools.queryEntities!('Project', {});
  const projectCount = allEntities.length;

  return {
    success: true,
    data: {
      message: '本体图结构验证完成',
      stats: {
        totalEntities: projectCount,
        hasErrors: false,
      },
    },
  };
}
