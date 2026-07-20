import { useCallback, useEffect, useRef } from 'react';
import { uploadWorkspaceFiles } from '@originos/core/lib/integrations/electron/services/workspace';

export interface UploadedFile {
  name: string;
  path: string;
  size: number;
}

export type UploadState = 'idle' | 'uploading' | 'done' | 'error';

interface UseFileUploadOptions {
  /** Base path for uploads — can be a static string or a function returning current value */
  basePath: string | (() => string | null);
  /** Called on successful upload with file metadata */
  onUploaded?: (files: UploadedFile[]) => void;
  /** Called on upload error */
  onError?: (error: Error) => void;
  /** Called when upload state changes */
  onStateChange?: (state: UploadState) => void;
  /** Maximum file size in bytes (default: 500MB) */
  maxSize?: number;
  /** Allowed MIME type patterns (e.g. ['image/*', 'application/pdf']) */
  allowedTypes?: string[];
}

const DEFAULT_MAX_SIZE = 500 * 1024 * 1024; // 500MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function matchesType(mimeType: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.endsWith('/*')) {
      return mimeType.startsWith(pattern.slice(0, -2));
    }
    return mimeType === pattern;
  });
}

function validateFiles(
  files: File[],
  maxSize: number,
  allowedTypes: string[] | undefined,
  onError?: (error: Error) => void,
): boolean {
  for (const file of files) {
    if (file.size > maxSize) {
      onError?.(new Error(`文件 "${file.name}" 超过 ${formatFileSize(maxSize)} 大小限制`));
      return false;
    }
    if (allowedTypes && !matchesType(file.type, allowedTypes)) {
      onError?.(new Error(`文件 "${file.name}" 的类型 "${file.type || 'unknown'}" 不被支持`));
      return false;
    }
  }
  return true;
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function useFileUpload({
  basePath,
  onUploaded,
  onError,
  onStateChange,
  maxSize = DEFAULT_MAX_SIZE,
  allowedTypes,
}: UseFileUploadOptions) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const getInput = useCallback(() => {
    if (inputRef.current && document.body.contains(inputRef.current)) {
      return inputRef.current;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '-9999px';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.opacity = '0';
    document.body.appendChild(input);
    inputRef.current = input;
    return input;
  }, []);

  useEffect(() => {
    return () => {
      const input = inputRef.current;
      if (!input) return;
      input.onchange = null;
      input.remove();
      inputRef.current = null;
    };
  }, []);

  return useCallback(async () => {
    const resolvedBasePath = typeof basePath === 'function' ? basePath() : basePath;
    if (!resolvedBasePath) return;

    const input = getInput();

    const cleanup = () => {
      input.value = '';
      input.onchange = null;
    };

    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      input.value = '';

      if (files.length === 0) {
        cleanup();
        return;
      }

      if (!validateFiles(files, maxSize, allowedTypes, onError)) {
        onStateChange?.('error');
        cleanup();
        return;
      }

      onStateChange?.('uploading');

      try {
        const uploadFiles = await Promise.all(
          Array.from(files).map(async (file) => ({
            name: file.name,
            content: await fileToBase64(file),
            encoding: 'base64' as const,
          })),
        );
        const result = await uploadWorkspaceFiles({
          basePath: resolvedBasePath,
          files: uploadFiles,
        });
        if (result.success) {
          onStateChange?.('done');
          onUploaded?.(result.data?.files ?? []);
          // Reset to idle after a short delay
          setTimeout(() => onStateChange?.('idle'), 1000);
        } else {
          onStateChange?.('error');
          onError?.(new Error(result.error?.message || 'Upload failed'));
        }
      } catch (error) {
        onStateChange?.('error');
        onError?.(error as Error);
      } finally {
        cleanup();
      }
    };

    input.value = '';
    input.click();
  }, [basePath, onUploaded, onError, onStateChange, maxSize, allowedTypes, getInput]);
}
