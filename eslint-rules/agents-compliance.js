/**
 * 自定义 ESLint 规则：强制执行 AGENTS.md 架构规约
 */

module.exports = {
  rules: {
    /**
     * 规则：禁止在 src/app/ 下导入业务逻辑
     * AGENTS.md 第 3 章：目录结构规约
     */
    'no-business-logic-in-app': {
      meta: {
        type: 'problem',
        docs: {
          description: '禁止在 src/app/ 下放置业务逻辑',
          category: 'Architecture',
          recommended: true,
        },
        messages: {
          noBusinessLogic:
            '违反 AGENTS.md 规约：src/app/ 仅用于路由和页面组件。所有业务逻辑必须在 src/lib/ 中。',
        },
      },
      create(context) {
        const filename = context.getFilename();
        if (!filename.includes('/src/app/')) {
          return {};
        }

        return {
          ImportDeclaration(node) {
            const importPath = node.source.value;
            // 允许从 lib 导入，但不允许在 app 中定义业务逻辑
            if (
              !importPath.startsWith('@/lib') &&
              !importPath.startsWith('../lib') &&
              !importPath.startsWith('react') &&
              !importPath.startsWith('next')
            ) {
              // 检查是否是相对导入且不是组件
              if (importPath.startsWith('.') && !importPath.includes('component')) {
                context.report({
                  node,
                  messageId: 'noBusinessLogic',
                });
              }
            }
          },
        };
      },
    },

    /**
     * 规则：强制 feature 模块通过 index.ts 导出
     * AGENTS.md 第 3 章：功能模块必须独立
     */
    'feature-public-api-only': {
      meta: {
        type: 'problem',
        docs: {
          description: '禁止跨 feature 直接导入内部实现',
          category: 'Architecture',
          recommended: true,
        },
        messages: {
          usePublicApi:
            '违反 AGENTS.md 规约：禁止跨 feature 直接导入内部实现。必须通过 index.ts 导出公共 API。',
        },
      },
      create(context) {
        const filename = context.getFilename();
        const currentFeature = filename.match(/\/features\/([^\/]+)\//)?.[1];

        if (!currentFeature) {
          return {};
        }

        return {
          ImportDeclaration(node) {
            const importPath = node.source.value;
            const importFeature = importPath.match(/\/features\/([^\/]+)\//)?.[1];

            // 如果导入其他 feature 且不是从 index.ts
            if (
              importFeature &&
              importFeature !== currentFeature &&
              !importPath.endsWith('/index')
            ) {
              context.report({
                node,
                messageId: 'usePublicApi',
              });
            }
          },
        };
      },
    },

    /**
     * 规则：禁止使用 Class 组件
     * AGENTS.md 第 2 章：必须使用函数式组件
     */
    'no-class-components': {
      meta: {
        type: 'problem',
        docs: {
          description: '禁止使用 Class 组件',
          category: 'Architecture',
          recommended: true,
        },
        messages: {
          noClassComponent:
            '违反 AGENTS.md 规约：禁止使用 Class 组件。必须使用函数式组件 + Hooks。',
        },
      },
      create(context) {
        return {
          ClassDeclaration(node) {
            // 检查是否继承自 React.Component 或 Component
            if (
              node.superClass &&
              (node.superClass.name === 'Component' ||
                (node.superClass.object?.name === 'React' &&
                  node.superClass.property?.name === 'Component'))
            ) {
              context.report({
                node,
                messageId: 'noClassComponent',
              });
            }
          },
        };
      },
    },

    /**
     * 规则：强制本体数据结构符合规约
     * AGENTS.md 第 4 章：本体构建系统架构
     */
    'ontology-structure-compliance': {
      meta: {
        type: 'problem',
        docs: {
          description: '强制本体数据结构符合 AGENTS.md 规约',
          category: 'Architecture',
          recommended: true,
        },
        messages: {
          invalidOntologyStructure:
            '违反 AGENTS.md 规约：本体数据结构必须包含 id, name, createdAt, updatedAt 字段。',
        },
      },
      create(context) {
        const filename = context.getFilename();
        if (!filename.includes('/features/ontology/') && !filename.includes('/features/knowledge/')) {
          return {};
        }

        return {
          TSInterfaceDeclaration(node) {
            const interfaceName = node.id.name;
            if (
              interfaceName === 'Domain' ||
              interfaceName === 'Concept' ||
              interfaceName === 'Instance' ||
              interfaceName === 'Relation'
            ) {
              const requiredFields = ['id', 'createdAt', 'updatedAt'];
              const fields = node.body.body.map((member) => member.key?.name);

              const missingFields = requiredFields.filter(
                (field) => !fields.includes(field)
              );

              if (missingFields.length > 0) {
                context.report({
                  node,
                  messageId: 'invalidOntologyStructure',
                });
              }
            }
          },
        };
      },
    },

    /**
     * 规则：强制性能约束注释
     * AGENTS.md 第 6 章：性能约束
     */
    'performance-constraint-comment': {
      meta: {
        type: 'suggestion',
        docs: {
          description: '关键性能路径必须添加性能约束注释',
          category: 'Performance',
          recommended: true,
        },
        messages: {
          missingPerformanceComment:
            '建议添加性能约束注释（AGENTS.md 第 6 章）：例如 // Performance: Must complete in < 5s',
        },
      },
      create(context) {
        const filename = context.getFilename();
        const performanceCriticalFiles = [
          'graph-query.ts',
          'ontology-skills.ts',
          'project-interview.ts',
        ];

        if (!performanceCriticalFiles.some((file) => filename.includes(file))) {
          return {};
        }

        return {
          FunctionDeclaration(node) {
            const comments = context.getCommentsBefore(node);
            const hasPerformanceComment = comments.some((comment) =>
              comment.value.toLowerCase().includes('performance')
            );

            if (!hasPerformanceComment && node.id?.name.includes('query')) {
              context.report({
                node,
                messageId: 'missingPerformanceComment',
              });
            }
          },
        };
      },
    },
  },
};
