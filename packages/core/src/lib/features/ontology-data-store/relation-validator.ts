/**
 * Relation Validator — 验证实例间关系是否符合概念约束
 */

// Relation Validator - no external type imports needed

export interface ConceptRelation {
  id: string;
  sourceId: string; // concept id
  targetId: string;
  type: string;
  cardinality: '1:1' | '1:N' | 'N:1' | 'N:M';
}

export interface InstanceRelation {
  id: string;
  sourceInstanceId: string;
  targetInstanceId: string;
  type: string;
  sourceConceptId: string;
  targetConceptId: string;
}

export interface ValidationContext {
  constraints: ConceptRelation[];
  existingRelations: InstanceRelation[];
}

/**
 * 验证实例关系是否符合概念级约束
 */
export function validateInstanceRelation(
  newRelation: { sourceInstanceId: string; targetInstanceId: string; type: string; sourceConceptId: string; targetConceptId: string },
  context: ValidationContext
): { valid: boolean; error?: string } {
  // 1. 找到匹配的概念约束
  const constraint = context.constraints.find(
    c => c.sourceId === newRelation.sourceConceptId &&
         c.targetId === newRelation.targetConceptId &&
         (c.type === newRelation.type || c.type === '*')
  );

  // 如果没有定义概念级约束，允许创建（宽松模式）
  if (!constraint) {
    // 检查本 ontology 中是否存在任何针对这对概念的关系定义
    const anyConstraintForPair = context.constraints.find(
      c => c.sourceId === newRelation.sourceConceptId && c.targetId === newRelation.targetConceptId
    );
    // 完全没有这对概念的任何约束 → 放行
    if (!anyConstraintForPair) {
      return { valid: true };
    }
    // 有约束但不匹配当前 type → 拒绝
    return {
      valid: false,
      error: `概念 "${newRelation.sourceConceptId}" 到 "${newRelation.targetConceptId}" 之间不允许类型为 "${newRelation.type}" 的关系`
    };
  }

  // 2. 检查是否已存在相同关系
  const exists = context.existingRelations.find(
    r => r.sourceInstanceId === newRelation.sourceInstanceId &&
         r.targetInstanceId === newRelation.targetInstanceId &&
         r.type === newRelation.type
  );
  if (exists) {
    return { valid: false, error: '该关系已存在' };
  }

  // 3. Cardinality 约束检查
  const { cardinality } = constraint;

  if (cardinality === '1:1' || cardinality === '1:N') {
    // 源实例在该关系类型下只能有一个目标
    const sourceCount = context.existingRelations.filter(
      r => r.sourceInstanceId === newRelation.sourceInstanceId && r.type === newRelation.type
    ).length;
    if (sourceCount >= 1) {
      return { valid: false, error: `违反 1:${cardinality.split(':')[1]} 约束：源实例已有一条 ${newRelation.type} 关系` };
    }
  }

  if (cardinality === '1:1' || cardinality === 'N:1') {
    // 目标实例在该关系类型下只能有一个源
    const targetCount = context.existingRelations.filter(
      r => r.targetInstanceId === newRelation.targetInstanceId && r.type === newRelation.type
    ).length;
    if (targetCount >= 1) {
      return { valid: false, error: `违反 ${cardinality.split(':')[0]}:1 约束：目标实例已有一条 ${newRelation.type} 关系` };
    }
  }

  return { valid: true };
}

/**
 * 获取某对概念之间允许的关系类型列表
 */
export function getAllowedRelationTypes(
  sourceConceptId: string,
  targetConceptId: string,
  constraints: ConceptRelation[]
): string[] {
  const forward = constraints
    .filter(c => c.sourceId === sourceConceptId && c.targetId === targetConceptId)
    .map(c => c.type);
  const reverse = constraints
    .filter(c => c.sourceId === targetConceptId && c.targetId === sourceConceptId)
    .map(c => c.type);
  return [...forward, ...reverse];
}
