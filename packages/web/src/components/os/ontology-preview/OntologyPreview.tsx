'use client';

/**
 * Story 1.3: Initial Ontology Structure Generation
 * Component: OntologyPreview
 * Displays the generated ontology in a tree structure with animations
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { OntologyEntity } from '@originos/core/types';

// ============================================================================
// Types
// ============================================================================

export interface OntologyNode {
  id: string;
  type: string;
  name: string;
  description?: string;
  children?: OntologyNode[];
  relations?: OntologyNode[];
  isExpanded?: boolean;
  level: number;
  parentId?: string;
}

export interface OntologyPreviewProps {
  /** Generated ontology data from interview */
  ontology: {
    entities: OntologyEntity[];
    relations: Array<Record<string, unknown>>;
  };
  /** Current preview state */
  state: 'generating' | 'preview' | 'editing' | 'confirming' | 'success';
  /** Animation phase for Wow Moment */
  animationPhase?: 'center' | 'radiation' | 'children' | 'complete';
  /** Node selection handler */
  onNodeSelect?: (node: OntologyNode) => void;
  /** Confirmation handler */
  onConfirm?: () => void;
  /** Edit mode controls */
  editMode?: boolean;
  /** Edit handlers */
  onNodeRename?: (nodeId: string, newName: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  onNodeAdd?: (parentId: string, name: string, type: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const ANIMATION_DURATION = {
  nodeGrowth: 500,
  connectionFluid: 300,
  breathing: 2000,
  success: 400,
  expandCollapse: 250,
};

const NODE_ICONS: Record<string, string> = {
  Domain: '🌐',
  Project: '🎯',
  Person: '👤',
  Task: '📋',
  Goal: '🚩',
  Action: '⚡',
  Organization: '🏢',
  Relation: '🔗',
};

const NODE_COLORS: Record<string, string> = {
  Domain: '#6366F1', // Indigo
  Project: '#EC4899', // Pink
  Person: '#3B82F6', // Blue
  Task: '#10B981', // Green
  Goal: '#F59E0B', // Amber
  Action: '#8B5CF6', // Purple
  Organization: '#06B6D4', // Cyan
  Relation: '#9CA3AF', // Gray
};

// ============================================================================
// Helper Functions
// ============================================================================

function buildTreeFromEntities(entities: OntologyEntity[]): OntologyNode[] {
  const nodeMap = new Map<string, OntologyNode>();
  const roots: OntologyNode[] = [];

  // Create all nodes first
  entities.forEach(entity => {
    const node: OntologyNode = {
      id: entity.id,
      type: entity.type,
      name: (entity.properties as Record<string, string>)['name'] || entity.type,
      description: (entity.properties as Record<string, string>)['description'],
      children: [],
      relations: [],
      isExpanded: entity.type === 'Domain' || entity.type === 'Project',
      level: 0,
    };
    nodeMap.set(entity.id, node);
  });

  // Build hierarchy (simplified - would use relations in real implementation)
  entities.forEach(entity => {
    const node = nodeMap.get(entity.id);
    if (!node) return;

    const props = entity.properties as Record<string, any>;

    // Find parent if exists
    if (props['project'] && nodeMap.has(props['project'])) {
      const parent = nodeMap.get(props['project'])!;
      node.level = parent.level + 1;
      node.parentId = props['project'];
      parent.children?.push(node);
    } else if (props['assignee'] && nodeMap.has(props['assignee'])) {
      const person = nodeMap.get(props['assignee'])!;
      node.level = person.level + 1;
      node.parentId = props['assignee'];
      person.children?.push(node);
    } else {
      // Root level
      roots.push(node);
    }
  });

  return roots;
}

// ============================================================================
// Subcomponents
// ============================================================================

/**
 * Tree Node Component
 */
interface TreeNodeProps {
  node: OntologyNode;
  animationDelay?: number;
  isSelected?: boolean;
  editMode?: boolean;
  onToggle?: (nodeId: string) => void;
  onSelect?: (node: OntologyNode) => void;
  onRename?: (nodeId: string, newName: string) => void;
  onDelete?: (nodeId: string) => void;
  onAddChild?: (parentId: string) => void;
}

function TreeNode({
  node,
  animationDelay = 0,
  isSelected = false,
  editMode = false,
  onToggle,
  onSelect,
  onRename,
  onDelete,
  onAddChild,
}: TreeNodeProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);

  const handleToggle = useCallback(() => {
    onToggle?.(node.id);
  }, [node.id, onToggle]);

  const handleSelect = useCallback(() => {
    onSelect?.(node);
  }, [node, onSelect]);

  const handleRename = useCallback(() => {
    if (renameValue.trim() && renameValue !== node.name) {
      onRename?.(node.id, renameValue.trim());
    }
    setIsRenaming(false);
  }, [renameValue, node.name, node.id, onRename]);

  const handleDelete = useCallback(() => {
    if (confirm(`确定删除 "${node.name}" 吗?`)) {
      onDelete?.(node.id);
    }
  }, [node.name, node.id, onDelete]);

  const handleAddChild = useCallback(() => {
    const newName = prompt('输入新节点名称:');
    if (newName?.trim()) {
      onAddChild?.(node.id);
    }
  }, [node.id, onAddChild]);

  return (
    <div className="tree-node" style={{ marginLeft: node.level * 24 }}>
      {/* Node */}
      <motion.div
        className={`node-content ${isSelected ? 'selected' : ''} ${isRenaming ? 'renaming' : ''}`}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{
          opacity: 1,
          scale: isSelected ? 1.05 : 1,
        }}
        transition={{
          duration: ANIMATION_DURATION.nodeGrowth,
          ease: ANIMATION_DURATION.nodeGrowth,
          delay: animationDelay,
        }}
        style={{
          borderColor: NODE_COLORS[node.type] || '#9CA3AF',
        }}
        onClick={handleSelect}
      >
        {/* Expand/Collapse Toggle */}
        {node.children && node.children.length > 0 && (
          <motion.button
            className="toggle-button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            animate={{ rotate: node.isExpanded ? 90 : 0 }}
            transition={{
              duration: ANIMATION_DURATION.expandCollapse,
              ease: ANIMATION_DURATION.expandCollapse,
            }}
          >
            ▶
          </motion.button>
        )}

        {/* Icon */}
        <span className="node-icon">
          {NODE_ICONS[node.type] || '📄'}
        </span>

        {/* Name */}
        {isRenaming ? (
          <input
            type="text"
            className="rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRename();
              } else if (e.key === 'Escape') {
                setIsRenaming(false);
                setRenameValue(node.name);
              }
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="node-name">{node.name}</span>
        )}

        {/* Description */}
        {node.description && !isRenaming && (
          <span className="node-description">{node.description}</span>
        )}

        {/* Edit Mode Actions */}
        {editMode && !isRenaming && (
          <div className="node-actions">
            <motion.button
              className="action-button rename"
              onClick={(e) => {
                e.stopPropagation();
                setIsRenaming(true);
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              ✏️
            </motion.button>
            <motion.button
              className="action-button add"
              onClick={(e) => {
                e.stopPropagation();
                handleAddChild();
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              ➕
            </motion.button>
            <motion.button
              className="action-button delete"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              🗑️
            </motion.button>
          </div>
        )}
      </motion.div>

      {/* Children */}
      <AnimatePresence>
        {node.isExpanded && node.children && node.children.length > 0 && (
          <motion.div
            className="node-children"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: ANIMATION_DURATION.expandCollapse,
              ease: ANIMATION_DURATION.expandCollapse,
            }}
          >
            {node.children.map((child, index) => (
              <TreeNode
                key={child.id}
                node={child}
                animationDelay={index * 50}
                isSelected={isSelected}
                editMode={editMode}
                onToggle={onToggle}
                onSelect={onSelect}
                onRename={onRename}
                onDelete={onDelete}
                onAddChild={onAddChild}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Wow Moment Animation Component
 */
function WowMomentAnimation() {
  const [phase, setPhase] = useState<'center' | 'radiation' | 'children'>('center');

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setPhase('radiation');
    }, ANIMATION_DURATION.nodeGrowth);

    const timer2 = setTimeout(() => {
      setPhase('children');
    }, ANIMATION_DURATION.nodeGrowth + ANIMATION_DURATION.connectionFluid);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div className="wow-moment-container">
      <motion.div
        className="center-pulse"
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: phase === 'center' || phase === 'radiation' ? 1 : 0.5,
          opacity: phase === 'center' ? 1 : 0,
        }}
        transition={{
          duration: ANIMATION_DURATION.nodeGrowth,
          ease: ANIMATION_DURATION.nodeGrowth,
        }}
      />

      <motion.div
        className="radiation-ring"
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: phase === 'radiation' || phase === 'children' ? 2 : 0,
          opacity: phase === 'radiation' ? 0.5 : 0,
        }}
        transition={{
          duration: ANIMATION_DURATION.connectionFluid * 2,
          ease: ANIMATION_DURATION.connectionFluid,
        }}
      />

      {phase === 'children' && (
        <motion.div
          className="particles"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="particle"
              initial={{ scale: 0, x: 0, y: 0 }}
              animate={{
                scale: 1,
                x: Math.cos((i / 6) * Math.PI * 2) * 100,
                y: Math.sin((i / 6) * Math.PI * 2) * 100,
              }}
              transition={{
                duration: ANIMATION_DURATION.nodeGrowth,
                ease: ANIMATION_DURATION.nodeGrowth,
                delay: i * 50,
              }}
              style={{
                background: NODE_COLORS['Task'],
              }}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function OntologyPreview({
  ontology,
  state,
  onNodeSelect,
  onConfirm,
  editMode = false,
  onNodeRename,
  onNodeDelete,
  onNodeAdd,
}: OntologyPreviewProps) {
  const [treeData, setTreeData] = useState<OntologyNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<OntologyNode | null>(null);

  // Build tree when ontology changes
  useEffect(() => {
    const tree = buildTreeFromEntities(ontology.entities);
    setTreeData(tree);
  }, [ontology]);

  const handleToggle = useCallback((nodeId: string) => {
    const toggleNode = (nodes: OntologyNode[]): OntologyNode[] => {
      return nodes.map(node => {
        if (node.id === nodeId) {
          return { ...node, isExpanded: !node.isExpanded };
        }
        if (node.children) {
          return { ...node, children: toggleNode(node.children) };
        }
        return node;
      });
    };
    setTreeData(toggleNode(treeData));
  }, [treeData]);

  const handleSelect = useCallback((node: OntologyNode) => {
    setSelectedNode(node);
    onNodeSelect?.(node);
  }, [onNodeSelect]);

  const handleRename = useCallback((nodeId: string, newName: string) => {
    if (onNodeRename) {
      onNodeRename(nodeId, newName);
      // Update local state
      const renameNode = (nodes: OntologyNode[]): OntologyNode[] => {
        return nodes.map(node => {
          if (node.id === nodeId) {
            return { ...node, name: newName };
          }
          if (node.children) {
            return { ...node, children: renameNode(node.children) };
          }
          return node;
        });
      };
      setTreeData(renameNode(treeData));
    }
  }, [onNodeRename, treeData]);

  const handleDelete = useCallback((nodeId: string) => {
    if (onNodeDelete) {
      onNodeDelete(nodeId);
      // Update local state
      const deleteNode = (nodes: OntologyNode[]): OntologyNode[] => {
        return nodes
          .filter(node => node.id !== nodeId)
          .map(node => ({
            ...node,
            children: node.children ? deleteNode(node.children) : [],
          }));
      };
      setTreeData(deleteNode(treeData));
    }
  }, [onNodeDelete, treeData]);

  const handleAddChild = useCallback((parentId: string) => {
    if (onNodeAdd) {
      const newNodeId = `new_${Date.now()}`;
      onNodeAdd(parentId, newNodeId, 'entity');
    }
  }, [onNodeAdd]);

  return (
    <div className="ontology-preview">
      {/* Generating State */}
      {state === 'generating' && (
        <motion.div
          className="generating-state"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <WowMomentAnimation />
          <motion.p
            className="generating-text"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ANIMATION_DURATION.nodeGrowth * 2 }}
          >
            正在生成本体结构...
          </motion.p>
        </motion.div>
      )}

      {/* Preview/Edit State */}
      {(state === 'preview' || state === 'editing') && (
        <motion.div
          className="preview-state"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: ANIMATION_DURATION.nodeGrowth }}
        >
          <div className="ontology-header">
            <h2>本体结构预览</h2>
            {editMode && (
              <p className="edit-mode-hint">点击节点可编辑: 重命名、添加子节点、删除</p>
            )}
          </div>

          <div className="ontology-tree-container">
            <div className="ontology-tree">
              {treeData.map((rootNode, index) => (
                <TreeNode
                  key={rootNode.id}
                  node={rootNode}
                  animationDelay={index * 100}
                  isSelected={selectedNode?.id === rootNode.id}
                  editMode={editMode}
                  onToggle={handleToggle}
                  onSelect={handleSelect}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onAddChild={handleAddChild}
                />
              ))}
            </div>

            {/* Selected Node Details */}
            {selectedNode && (
              <motion.div
                className="node-details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <h3>{NODE_ICONS[selectedNode.type] || '📄'} {selectedNode.name}</h3>
                <p>Type: {selectedNode.type}</p>
                {selectedNode.description && (
                  <p>{selectedNode.description}</p>
                )}
                {selectedNode.children && selectedNode.children.length > 0 && (
                  <p>Children: {selectedNode.children.length}</p>
                )}
              </motion.div>
            )}
          </div>

          {/* Action Buttons */}
          <motion.div
            className="action-buttons"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ANIMATION_DURATION.nodeGrowth * 2 }}
          >
            {editMode && (
              <motion.button
                className="secondary-button"
                onClick={() => onConfirm?.()}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                完成编辑
              </motion.button>
            )}
            <motion.button
              className="primary-button"
              onClick={onConfirm}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              ✅ 确认使用此本体
            </motion.button>
          </motion.div>
        </motion.div>
      )}

      {/* Confirming/Success State */}
      {(state === 'confirming' || state === 'success') && (
        <motion.div
          className="success-state"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: ANIMATION_DURATION.success }}
        >
          <motion.div
            className="success-icon"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: 'spring',
              damping: 15,
            }}
          >
            ✨
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ANIMATION_DURATION.success * 0.2 }}
          >
            本体创建成功！
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: ANIMATION_DURATION.success * 0.4 }}
          >
            正在为您进入主界面...
          </motion.p>
        </motion.div>
      )}

      <style jsx>{`
        .ontology-preview {
          width: 100%;
          height: 100%;
          padding: 24px;
        }

        .generating-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
        }

        .wow-moment-container {
          position: relative;
          width: 200px;
          height: 200px;
        }

        .center-pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366F1, #EC4899);
          transform: translate(-50%, -50%);
          box-shadow: 0 0 30px rgba(99, 102, 241, 0.5);
        }

        .radiation-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          border: 2px solid #6366F1;
          transform: translate(-50%, -50%);
        }

        .particles {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 300px;
          height: 300px;
          transform: translate(-50%, -50%);
        }

        .particle {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          transform: translate(-50%, -50%);
        }

        .generating-text {
          margin-top: 32px;
          font-size: 16px;
          color: #6B7280;
        }

        .preview-state {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .ontology-header {
          margin-bottom: 24px;
        }

        .ontology-header h2 {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .edit-mode-hint {
          font-size: 14px;
          color: #6B7280;
        }

        .ontology-tree-container {
          flex: 1;
          display: flex;
          gap: 16px;
          overflow: hidden;
        }

        .ontology-tree {
          flex: 1;
          overflow-y: auto;
        }

        .tree-node {
          margin: 4px 0;
        }

        .node-content {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border: 2px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          transition: all 200ms ease;
          background: white;
        }

        .node-content:hover {
          background: #F9FAFB;
        }

        .node-content.selected {
          background: #EEF2FF;
        }

        .node-content.renaming {
          border-color: #6366F1;
        }

        .toggle-button {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 12px;
          color: #6B7280;
        }

        .node-icon {
          font-size: 18px;
        }

        .node-name {
          font-weight: 500;
        }

        .node-description {
          font-size: 12px;
          color: #9CA3AF;
        }

        .node-actions {
          margin-left: auto;
          display: flex;
          gap: 4px;
          opacity: 0;
          transition: opacity 200ms;
        }

        .node-content:hover .node-actions {
          opacity: 1;
        }

        .action-button {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border: 1px solid #E5E7EB;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .action-button.rename:hover,
        .action-button.add:hover {
          border-color: #6366F1;
          background: #EEF2FF;
        }

        .action-button.delete:hover {
          border-color: #EF4444;
          background: #FEF2F2;
        }

        .rename-input {
          margin: 0;
          padding: 4px 8px;
          border: 1px solid #6366F1;
          border-radius: 4px;
          font-size: 14px;
          outline: none;
        }

        .node-children {
          overflow: hidden;
        }

        .node-details {
          width: 300px;
          padding: 16px;
          background: white;
          border-radius: 8px;
          border: 1px solid #E5E7EB;
        }

        .node-details h3 {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .node-details p {
          font-size: 14px;
          color: #6B7280;
          margin: 8px 0;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
          padding: 16px;
        }

        .primary-button,
        .secondary-button {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }

        .primary-button {
          background: linear-gradient(135deg, #6366F1, #EC4899);
          color: white;
        }

        .secondary-button {
          background: white;
          border: 1px solid #E5E7EB;
          color: #374151;
        }

        .success-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
        }

        .success-icon {
          font-size: 80px;
          margin-bottom: 24px;
        }

        .success-state h2 {
          font-size: 32px;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .success-state p {
          font-size: 16px;
          color: #6B7280;
        }
      `}</style>
    </div>
  );
}
