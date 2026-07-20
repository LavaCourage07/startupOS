/**
 * shared/model/factory.ts — Layer 0 模型工厂接口
 *
 * 仅接口定义，无运行时实现。
 * 允许 modules/ 通过依赖注入获取模型，而不直接 import lib/integrations/。
 */

export interface ModelFactory {
  createAutoModel(): unknown;
}
