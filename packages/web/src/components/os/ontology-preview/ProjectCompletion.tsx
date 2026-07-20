'use client';

/**
 * Story 1.3: Project Completion Interface
 *
 * Complete flow after interview:
 * 1. Show ontology preview with Wow Moment animation
 * 2. Allow editing of ontology
 * 3. Confirm with success animation
 * 4. Persist and transition to main interface
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OntologyPreview } from '@/components/os/ontology-preview';
import { agentSessionService } from '@originos/core/lib/features/agent';
import type { AgentSession, OntologyEntity } from '@originos/core/types';

type PreviewState =
  | 'generating' // Showing Wow Moment animation
  | 'preview'     // Tree structure display
  | 'editing'     // Edit mode
  | 'confirming'  // Success animation
  | 'success';    // Persistence done

interface ProjectCompletionProps {
  /** Agent session ID */
  sessionId: string;
  /** Completion callback */
  onComplete?: (projectData: any) => void;
  /** Cancel callback */
  onCancel?: () => void;
}

export default function ProjectCompletion({
  sessionId,
  onComplete,
  onCancel,
}: ProjectCompletionProps) {
  const [state, setState] = useState<PreviewState>('generating');
  const [session, setSession] = useState<AgentSession | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [ontologyData, setOntologyData] = useState<{
    entities: OntologyEntity[];
    relations: Array<Record<string, unknown>>;
  }>({
    entities: [],
    relations: [],
  });

  // Load session on mount
  useEffect(() => {
    async function loadSession() {
      try {
        const agentSession = await agentSessionService.getSession(sessionId);
        if (agentSession) {
          setSession(agentSession);

          // Extract ontology from session context
          const entities = agentSession.messages
            .filter((m: any) => m.toolResults?.length > 0)
            .flatMap((m: any) =>
              m.toolResults
                ?.filter((r: any) => r.data?.entities_created)
                .flatMap((r: any) => r.data.entities_created as any[]) || []
            );

          setOntologyData({
            entities,
            relations: [],
          });
        }
      } catch (error) {
        console.error('Failed to load session:', error);
      }
    }

    loadSession();
  }, [sessionId]);

  // Progress through states
  useEffect(() => {
    const timer = setTimeout(() => {
      setState('preview');
    }, 2500); // 2.5s for Wow Moment animation

    return () => clearTimeout(timer);
  }, []);

  // Node handlers
  const handleNodeSelect = useCallback((node: any) => {
    console.log('Selected node:', node);
  }, []);

  const handleNodeRename = useCallback((nodeId: string, newName: string) => {
    console.log('Renaming node:', nodeId, 'to:', newName);
    // Implement actual rename logic
  }, []);

  const handleNodeDelete = useCallback((nodeId: string) => {
    console.log('Deleting node:', nodeId);
    // Implement actual delete logic
  }, []);

  const handleNodeAdd = useCallback((parentId: string, newNodeId: string) => {
    console.log('Adding node to:', parentId, newNodeId);
    // Implement actual add logic
  }, []);

  // Confirm handler
  const handleConfirm = useCallback(async () => {
    if (editMode) {
      setEditMode(false);
      return;
    }

    setState('confirming');

    // Persist ontology data
    if (session?.projectContext?.projectId) {
      const projectId = session.projectContext.projectId as string;
      try {
        // In production, save actual data
        console.log('Persisting ontology for project:', projectId, ontologyData);
      } catch (error) {
        console.error('Failed to persist ontology:', error);
      }
    }

    // Transition to complete state
    setTimeout(() => {
      setState('success');
      onComplete?.({
        projectId: session?.projectContext?.projectId,
        projectName: session?.projectContext?.projectName,
        ontology: ontologyData,
      });
    }, 400);
  }, [editMode, ontologyData, session, onComplete]);

  const handleEdit = useCallback(() => {
    setEditMode(true);
    setState('editing');
  }, []);

  return (
    <motion.div
      className="project-completion"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <motion.header
        className="completion-header"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <h1>
          🎉 项目 "{session?.projectContext?.projectName || '未命名'}" 创建完成！
        </h1>
        <p>我们根据您的对话为您生成了初始本体结构</p>
      </motion.header>

      {/* Main Content */}
      <motion.main
        className="completion-main"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
      >
        <OntologyPreview
          ontology={ontologyData}
          state={state === 'editing' ? 'editing' : state}
          editMode={editMode}
          onNodeSelect={handleNodeSelect}
          onNodeRename={handleNodeRename}
          onNodeDelete={handleNodeDelete}
          onNodeAdd={handleNodeAdd}
          onConfirm={handleConfirm}
        />
      </motion.main>

      {/* Footer Actions */}
      <AnimatePresence>
        {state === 'preview' && (
          <motion.footer
            className="completion-footer"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ delay: 0.5 }}
          >
            <motion.button
              className="secondary-action"
              onClick={onCancel}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              ❌ 取消
            </motion.button>
            <motion.button
              className="edit-action"
              onClick={handleEdit}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              ✏️ 编辑本体
            </motion.button>
          </motion.footer>
        )}
      </AnimatePresence>

      <style jsx>{`
        .project-completion {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: linear-gradient(135deg, #F9FAFB 0%, #EEF2FF 100%);
          padding: 24px;
        }

        .completion-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .completion-header h1 {
          font-size: 28px;
          font-weight: 600;
          margin-bottom: 8px;
          background: linear-gradient(135deg, #6366F1, #EC4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .completion-header p {
          font-size: 16px;
          color: #6B7280;
        }

        .completion-main {
          flex: 1;
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .completion-footer {
          display: flex;
          gap: 12px;
          justify-content: center;
          padding: 24px 0;
        }

        .secondary-action,
        .edit-action,
        .primary-action {
          padding: 12px 32px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }

        .secondary-action {
          background: white;
          border: 1px solid #E5E7EB;
          color: #374151;
        }

        .edit-action {
          background: linear-gradient(135deg, #6366F1, #8B5CF6);
          color: white;
        }

        .primary-action {
          background: linear-gradient(135deg, #6366F1, #EC4899);
          color: white;
        }
      `}</style>
    </motion.div>
  );
}
