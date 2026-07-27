'use client';

import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { FileContent } from '@originos/core/types';
import { normalizeMarkdownTables } from '@/services/normalize-markdown-tables';

interface MarkdownEditorProps {
  fileContent: FileContent | null;
  onSave: (content: string) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Markdown editor with toolbar and real-time preview
 */
export function MarkdownEditor({ fileContent, onSave }: MarkdownEditorProps) {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    if (fileContent) {
      setContent(fileContent.content);
      setHasUnsavedChanges(false);
    }
  }, [fileContent]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasUnsavedChanges(newContent !== fileContent?.content);
  };

  const handleSave = useCallback(async () => {
    if (!fileContent || !hasUnsavedChanges) return;

    setIsSaving(true);
    try {
      await onSave(content);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [fileContent, content, hasUnsavedChanges, onSave]);

  // Keyboard shortcut: Cmd/Ctrl + S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = document.getElementById('markdown-editor') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newContent =
      content.substring(0, start) + before + selectedText + after + content.substring(end);

    setContent(newContent);
    setHasUnsavedChanges(true);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  if (!fileContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        <p>选择文件开始编辑</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => insertMarkdown('**', '**')}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="粗体"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 5a1 1 0 011-1h5.5a3.5 3.5 0 110 7H4v3a1 1 0 11-2 0V5zm3 5h4.5a1.5 1.5 0 000-3H6v3z" />
            </svg>
          </button>
          <button
            onClick={() => insertMarkdown('*', '*')}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="斜体"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1z" />
            </svg>
          </button>
          <button
            onClick={() => insertMarkdown('## ')}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="标题"
          >
            H
          </button>
          <button
            onClick={() => insertMarkdown('- ')}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="列表"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <button
            onClick={() => insertMarkdown('[', '](url)')}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="链接"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <div className="w-px h-6 bg-gray-300 mx-2" />
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              showPreview ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
            }`}
          >
            预览
          </button>
        </div>
        <div className="flex items-center space-x-3">
          {hasUnsavedChanges && (
            <span className="text-xs text-orange-600">● 未保存</span>
          )}
          {isSaving && <span className="text-xs text-gray-500">保存中...</span>}
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            保存 (⌘S)
          </button>
        </div>
      </div>

      {/* Editor and Preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className={`${showPreview ? 'w-1/2' : 'w-full'} flex flex-col border-r border-gray-200`}>
          <textarea
            id="markdown-editor"
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            className="flex-1 p-4 font-mono text-sm text-gray-900 dark:text-white bg-transparent resize-none focus:outline-none"
            placeholder="开始编写 Markdown..."
          />
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="w-1/2 overflow-auto p-4 bg-gray-50 dark:bg-gray-900">
            <article className="prose prose-sm max-w-none text-gray-900 dark:text-white [&_h1]:text-gray-900 [&_h1]:dark:text-white [&_h2]:text-gray-900 [&_h2]:dark:text-white [&_h3]:text-gray-900 [&_h3]:dark:text-white [&_p]:text-gray-900 [&_p]:dark:text-white [&_li]:text-gray-900 [&_li]:dark:text-white [&_a]:text-blue-500 [&_a]:dark:text-blue-400">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {normalizeMarkdownTables(content)}
              </ReactMarkdown>
            </article>
          </div>
        )}
      </div>
    </div>
  );
}
