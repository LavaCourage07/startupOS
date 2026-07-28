'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react';
import type { ProjectFile } from '@originos/core/types';

interface DirectoryTreeProps {
  files: ProjectFile[];
  selectedFileId: string | null;
  onFileSelect: (file: ProjectFile) => void;
  onOpenInSandbox?: (folderPath: string) => void;
}

/**
 * Directory tree sidebar for workspace
 * Displays hierarchical file structure
 */
export function DirectoryTree({ files, selectedFileId, onFileSelect, onOpenInSandbox }: DirectoryTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const treeFiles = useMemo(() => normalizeFilesForTree(files), [files]);

  // Auto-expand root folders on mount
  useEffect(() => {
    const rootFolders = treeFiles.filter(f => f.type === 'folder' && !f.parentPath);
    setExpandedFolders(new Set(rootFolders.map(f => f.path)));
  }, [treeFiles]);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Build tree structure
  const buildTree = () => {
    const rootItems: ProjectFile[] = [];
    const childrenMap = new Map<string, ProjectFile[]>();

    treeFiles.forEach(file => {
      if (!file.parentPath) {
        rootItems.push(file);
      } else {
        if (!childrenMap.has(file.parentPath)) {
          childrenMap.set(file.parentPath, []);
        }
        childrenMap.get(file.parentPath)!.push(file);
      }
    });

    // Sort: folders first, then by name
    const sortItems = (items: ProjectFile[]) => {
      return items.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    };

    const renderItem = (file: ProjectFile, depth: number = 0): JSX.Element => {
      const isFolder = file.type === 'folder';
      const isExpanded = expandedFolders.has(file.path);
      const isSelected = file.id === selectedFileId;
      const children = childrenMap.get(file.path) || [];

      // Detect sandboxable: folder with direct index.html child, or any .html file
      const isHtmlFile = !isFolder && file.name.endsWith('.html');
      const isIndexHtml = !isFolder && file.name === 'index.html';
      const hasSandboxApp = isFolder && children.some(c => c.type === 'file' && (c.name === 'index.html' || c.name.endsWith('.html')));

      return (
        <div key={file.id}>
          <div className="flex items-center group">
            <button
              onClick={() => {
                if (isFolder) {
                  toggleFolder(file.path);
                } else {
                  onFileSelect(file);
                }
              }}
              className={`flex-1 flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors ${
                isSelected
                  ? 'bg-blue-100 text-blue-900'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              {isFolder ? (
                <>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  )}
                  <Folder className="w-4 h-4 shrink-0 text-blue-500" />
                </>
              ) : (
                <>
                  <div className="w-4" />
                  <File className={`w-4 h-4 shrink-0 ${isIndexHtml ? 'text-emerald-500' : 'text-gray-400'}`} />
                </>
              )}
              <span className="truncate">{file.name}</span>
              {(hasSandboxApp || isHtmlFile) && (
                <span className="text-xs text-emerald-600 shrink-0">🔬</span>
              )}
            </button>
            {(hasSandboxApp || isHtmlFile) && onOpenInSandbox && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isIndexHtml) {
                    onOpenInSandbox(file.parentPath ?? '');
                  } else if (isHtmlFile) {
                    // 独立 .html 文件：传入文件所在目录路径 + 文件名
                    const dirPath = file.parentPath ?? '';
                    onOpenInSandbox(dirPath ? `${dirPath}/${file.name}` : file.name);
                  } else {
                    onOpenInSandbox(file.path);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 mr-1 px-1.5 py-0.5 text-xs rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-all shrink-0"
                title="在沙箱中打开"
              >
                打开
              </button>
            )}
          </div>
          {isFolder && isExpanded && children.length > 0 && (
            <div>
              {sortItems(children).map(child => renderItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    };

    return sortItems(rootItems).map(item => renderItem(item));
  };

  return (
    <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">文件</h3>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {treeFiles.length === 0 ? (
          <div className="px-2 py-4 text-sm text-gray-400 text-center">
            暂无文件
          </div>
        ) : (
          buildTree()
        )}
      </div>
    </div>
  );
}

export function normalizeFilesForTree(files: ProjectFile[]): ProjectFile[] {
  const byPath = new Map<string, ProjectFile>();

  const normalizePath = (value: string) => value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');

  const ensureFolder = (projectId: string, folderPath: string, timestamp: number) => {
    const normalizedFolderPath = normalizePath(folderPath);
    if (!normalizedFolderPath || byPath.has(normalizedFolderPath)) return;

    const segments = normalizedFolderPath.split('/');
    const parentPath = segments.length > 1 ? segments.slice(0, -1).join('/') : undefined;
    byPath.set(normalizedFolderPath, {
      id: `folder:${normalizedFolderPath}`,
      projectId,
      path: normalizedFolderPath,
      name: segments[segments.length - 1] ?? normalizedFolderPath,
      size: 0,
      createdAt: timestamp,
      modifiedAt: timestamp,
      type: 'folder',
      parentPath,
    });
  };

  for (const file of files) {
    const normalizedPath = normalizePath(file.path);
    if (!normalizedPath) continue;

    const segments = normalizedPath.split('/');
    for (let depth = 1; depth < segments.length; depth += 1) {
      ensureFolder(file.projectId, segments.slice(0, depth).join('/'), file.modifiedAt);
    }

    const parentPath = segments.length > 1 ? segments.slice(0, -1).join('/') : undefined;
    byPath.set(normalizedPath, {
      ...file,
      id: file.id || `${file.type}:${normalizedPath}`,
      path: normalizedPath,
      name: file.name || segments[segments.length - 1] || normalizedPath,
      parentPath,
    });
  }

  return Array.from(byPath.values());
}
