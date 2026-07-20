'use client';

import { useState } from 'react';
import type { FileContent } from '@originos/core/types';

interface ImageViewerProps {
  fileContent: FileContent | null;
}

/**
 * Image viewer that displays base64-encoded images with zoom/pan support
 */
export function ImageViewer({ fileContent }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);

  if (!fileContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-600">
        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p>选择一个图片文件查看</p>
      </div>
    );
  }

  const imageSrc = fileContent.content; // base64 data URL

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25));
  const handleReset = () => setZoom(1);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 0.25}
            className="px-2 py-1 text-sm rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="缩小"
          >
            −
          </button>
          <span className="text-sm text-gray-600 min-w-[40px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= 3}
            className="px-2 py-1 text-sm rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="放大"
          >
            +
          </button>
          <button
            onClick={handleReset}
            className="px-2 py-1 text-sm rounded hover:bg-gray-200 transition-colors"
            title="重置缩放"
          >
            适应
          </button>
        </div>
        <span className="text-xs text-gray-500">{fileContent.file.name}</span>
      </div>

      {/* Image */}
      <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-4">
        <img
          src={imageSrc}
          alt={fileContent.file.name}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            transition: 'transform 0.15s ease-out',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
          className="select-none"
          draggable={false}
        />
      </div>
    </div>
  );
}
