'use client';

import { useEffect, useState } from 'react';
import { useWorkspace } from '@/hooks/use-workspace';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import type { ProjectFile } from '@originos/core/types';

interface FileListProps {
  projectId: string;
  onFileSelect?: (file: ProjectFile) => void;
}

/**
 * File list component for workspace
 * Displays files sorted by modified time with folder support
 */
export function FileList({ projectId, onFileSelect }: FileListProps) {
  const { files, isLoading, error, loadFiles, selectFile, selectedFileId, deleteFile } = useWorkspace();
  const [deleteTarget, setDeleteTarget] = useState<ProjectFile | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const projectFiles = (files as any)[projectId] || [];

  useEffect(() => {
    if (projectId) {
      loadFiles(projectId);
    }
  }, [projectId, loadFiles]);

  const handleFileClick = (file: ProjectFile) => {
    if (file.type === 'folder') {
      // Toggle folder expansion
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        if (next.has(file.path)) {
          next.delete(file.path);
        } else {
          next.add(file.path);
        }
        return next;
      });
    } else {
      selectFile(file.id);
      onFileSelect?.(file);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, file: ProjectFile) => {
    e.stopPropagation();
    setDeleteTarget(file);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      try {
        await deleteFile(projectId, deleteTarget.path);
        setDeleteTarget(null);
      } catch (error) {
        console.error('Failed to delete file:', error);
      }
    }
  };

  // Build folder tree structure
  const buildFileTree = () => {
    const rootFiles: ProjectFile[] = [];
    const folderMap = new Map<string, ProjectFile[]>();

    projectFiles.forEach((file: any) => {
      if (!file.parentPath) {
        rootFiles.push(file);
      } else {
        if (!folderMap.has(file.parentPath)) {
          folderMap.set(file.parentPath, []);
        }
        folderMap.get(file.parentPath)!.push(file);
      }
    });

    return { rootFiles, folderMap };
  };

  const { rootFiles, folderMap } = buildFileTree();

  const renderFile = (file: ProjectFile, level: number = 0) => {
    const isFolder = file.type === 'folder';
    const isExpanded = expandedFolders.has(file.path);
    const children = isFolder ? folderMap.get(file.path) || [] : [];

    return (
      <div key={file.id}>
        <tr
          className={`hover:bg-gray-50 transition-colors ${
            selectedFileId === file.id ? 'bg-blue-50' : ''
          }`}
        >
          <td
            className="px-4 py-3 whitespace-nowrap cursor-pointer"
            onClick={() => handleFileClick(file)}
            style={{ paddingLeft: `${16 + level * 24}px` }}
          >
            <div className="flex items-center">
              {isFolder && (
                <svg
                  className={`w-4 h-4 mr-2 text-gray-400 transition-transform ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
              {isFolder ? (
                <svg
                  className="w-5 h-5 mr-2 text-yellow-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 mr-2 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              )}
              <span className="text-sm text-gray-900">{file.name}</span>
            </div>
          </td>
          <td
            className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
            onClick={() => handleFileClick(file)}
          >
            {formatDate(file.modifiedAt)}
          </td>
          <td
            className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
            onClick={() => handleFileClick(file)}
          >
            {formatFileSize(file.size)}
          </td>
          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
            <button
              onClick={(e) => handleDeleteClick(e, file)}
              className="text-red-600 hover:text-red-800 transition-colors"
              aria-label="删除文件"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </td>
        </tr>
        {isFolder && isExpanded && children.map((child) => renderFile(child, level + 1))}
      </div>
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '-';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} 小时前`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} 天前`;

    return date.toLocaleDateString('zh-CN');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  if (projectFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <svg
          className="w-16 h-16 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p>暂无文件</p>
        <p className="text-sm mt-2">创建第一个文件开始工作</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                名称
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                修改时间
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                大小
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rootFiles.map((file) => renderFile(file))}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        isOpen={!!deleteTarget}
        fileName={deleteTarget?.name || ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
