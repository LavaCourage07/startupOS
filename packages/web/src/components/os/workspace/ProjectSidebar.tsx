'use client';

import { useProjects } from '@/lib/hooks/use-projects';
import type { ProjectListItem } from '@originos/core/types';

interface ProjectSidebarProps {
  activeProjectId: string | null;
  onProjectSelect: (projectId: string) => void;
}

/**
 * Project sidebar for workspace
 * Displays list of projects for quick switching
 */
export function ProjectSidebar({ activeProjectId, onProjectSelect }: ProjectSidebarProps) {
  const { projects, isLoading } = useProjects({
    autoLoad: true,
    query: { status: 'active' },
  });

  const getProjectColor = (project: ProjectListItem) => {
    // Use project color or generate from name
    return project.color || '#3b82f6';
  };

  if (isLoading) {
    return (
      <div className="w-64 border-r border-gray-200 bg-gray-50 p-4">
        <div className="text-sm text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">项目</h3>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto p-2">
        {projects.length === 0 ? (
          <div className="px-2 py-4 text-sm text-gray-400 text-center">
            暂无项目
          </div>
        ) : (
          <div className="space-y-1">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => onProjectSelect(project.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeProjectId === project.id
                    ? 'bg-blue-100 text-blue-900'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                {/* Project Icon */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                  style={{ backgroundColor: getProjectColor(project) }}
                >
                  {project.name.charAt(0).toUpperCase()}
                </div>

                {/* Project Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {project.name}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {project.domain}
                  </div>
                </div>

                {/* Active Indicator */}
                {activeProjectId === project.id && (
                  <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          {projects.length} 个项目
        </div>
      </div>
    </div>
  );
}
