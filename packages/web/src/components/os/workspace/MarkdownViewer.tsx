'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { FileContent } from '@originos/core/types';

interface MarkdownViewerProps {
  fileContent: FileContent | null;
  isLoading?: boolean;
}

/**
 * Markdown file viewer with preview
 */
export function MarkdownViewer({ fileContent, isLoading }: MarkdownViewerProps) {
  const [loadTime, setLoadTime] = useState<number>(0);

  useEffect(() => {
    if (fileContent) {
      const startTime = performance.now();
      // Simulate load time measurement
      requestAnimationFrame(() => {
        const endTime = performance.now();
        setLoadTime(endTime - startTime);
      });
    }
  }, [fileContent]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!fileContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
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
        <p>选择文件查看内容</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* File header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-3">
          <svg
            className="w-5 h-5 text-gray-400"
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
          <span className="text-sm font-medium text-gray-900">
            {fileContent.file.name}
          </span>
        </div>
        <div className="flex items-center space-x-4 text-xs text-gray-500">
          <span>{(fileContent.file.size / 1024).toFixed(1)} KB</span>
          {loadTime > 0 && <span>加载时间: {loadTime.toFixed(0)}ms</span>}
        </div>
      </div>

      {/* Markdown content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <article className="prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {fileContent.content}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
