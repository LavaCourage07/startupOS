/**
 * CollaborationRuntimeUiDeps — UI 依赖注入接口（AG.2）
 *
 * module ui 子目录不得直接 import @/components/**，
 * 外部 UI 组件通过此接口由调用方注入。
 */

import type React from "react";

export interface MarkdownContentProps {
  content: string;
  className?: string;
}

export interface UploadedFileDisplay {
  name: string;
  path: string;
  size: number;
}

export interface UploadedFile {
  name: string;
  path: string;
  size: number;
}

export interface ChatInputBarProps {
  onSubmit: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onUpload?: () => void;
  className?: string;
  onStop?: () => void;
  isGenerating?: boolean;
  lightBg?: boolean;
  uploadedFiles?: UploadedFileDisplay[];
  onRemoveFile?: (index: number) => void;
  uploadError?: string | null;
  uploading?: boolean;
}

export interface QuestionOption {
  label: string;
  description: string;
}

export interface ParsedQuestion {
  question: string;
  options: QuestionOption[];
  multiSelect?: boolean;
}

export interface AskUserQuestionComponentProps {
  parsedQuestion: ParsedQuestion;
  onAnswer: (selectedLabels: string[]) => void;
  disabled: boolean;
}

export interface UseFileUploadOptions {
  basePath: (() => string | null) | string;
  onUploaded?: (files: UploadedFile[]) => void;
  onError?: (err: Error) => void;
  onStateChange?: (state: "idle" | "uploading" | "done" | "error") => void;
}

/** useFileUpload returns a callback that opens the file picker and uploads */
export type UseFileUploadResult = () => Promise<void>;

export interface CollaborationRuntimeUiDeps {
  MarkdownContent: React.ComponentType<MarkdownContentProps>;
  ChatInputBar: React.ComponentType<ChatInputBarProps>;
  AskUserQuestionComponent: React.ComponentType<AskUserQuestionComponentProps>;
  parseAskUserQuestion: (text: string) => ParsedQuestion | null;
  removeYamlBlock: (text: string) => string;
  useFileUpload: (options: UseFileUploadOptions) => UseFileUploadResult;
}
