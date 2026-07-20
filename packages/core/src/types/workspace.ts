/**
 * Workspace file and folder types
 * @module types/workspace
 */

/**
 * Project file or folder
 */
export interface ProjectFile {
  /** Unique file ID */
  id: string;
  /** Parent project ID */
  projectId: string;
  /** Relative path from project files root */
  path: string;
  /** File or folder name */
  name: string;
  /** File size in bytes (0 for folders) */
  size: number;
  /** Creation timestamp */
  createdAt: number;
  /** Last modification timestamp */
  modifiedAt: number;
  /** File or folder type */
  type: 'file' | 'folder';
  /** File extension (e.g., 'md', 'txt') */
  extension?: string;
  /** Parent folder path */
  parentPath?: string;
}

/**
 * File content with metadata
 */
export interface FileContent {
  /** File metadata */
  file: ProjectFile;
  /** File content as string */
  content: string;
  /** Content encoding */
  encoding: 'utf-8';
}

/**
 * Workspace state management
 */
export interface WorkspaceState {
  /** Currently active project ID */
  activeProjectId: string | null;
  /** Currently selected file ID */
  selectedFileId: string | null;
  /** Files by project ID */
  files: Record<string, ProjectFile[]>;
  /** Currently opened file content */
  openedFile: FileContent | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Base path for workspace API calls */
  activeBasePath: string | null;
}

/**
 * API response for file list
 */
export interface FileListResponse {
  files: ProjectFile[];
  total: number;
}

/**
 * API response for file content
 */
export interface FileContentResponse {
  file: ProjectFile;
  content: string;
  encoding?: 'utf-8' | 'base64';
  contentType?: string;
}
