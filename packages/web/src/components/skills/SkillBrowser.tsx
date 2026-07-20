'use client';

import { useState } from 'react';
import { Search, Settings, Plus, BookOpen, Zap, Database } from 'lucide-react';
import { listAvailableSkills } from '@originos/core/lib/integrations/electron/services/skill';

export interface SkillDefinition {
  name: string;
  description: string;
  version: string;
  type: 'SIMPLE' | 'COMPOSITE';
  tags: string[];
  author?: string;
}

interface SkillBrowserProps {
  onSkillSelect: (skillName: string) => void;
  onClose: () => void;
}

/**
 * SkillBrowser - 技能列表浏览组件
 *
 * 显示所有可用技能，支持搜索和筛选
 */
export function SkillBrowser({ onSkillSelect, onClose }: SkillBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 预定义分类
  const categories = [
    { id: 'all', name: '全部', icon: BookOpen },
    { id: 'project', name: '项目管理', icon: Settings },
    { id: 'ontology', name: '本体管理', icon: Database },
    { id: 'query', name: '信息查询', icon: Search },
    { id: 'ai', name: 'AI 工具', icon: Zap },
  ];

  // Load skills
  const loadSkills = async () => {
    setIsLoading(true);
    try {
      const data = await listAvailableSkills();
      if (data.success && data.data) {
        const skillsList: SkillDefinition[] = (data.data.skills || []).map((skill) => ({
          name: skill.name,
          description: skill.description,
          version: '1.0.0',
          type: 'SIMPLE',
          tags: [skill.source],
        }));
        setSkills(skillsList);
      }
    } catch (error) {
      console.error('Failed to load skills:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useState(() => {
    loadSkills();
  });

  // Filter skills
  const filteredSkills = skills.filter(skill => {
    const matchesSearch = searchQuery === '' ||
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'all' ||
      skill.tags.some(tag => tag.toLowerCase().includes(selectedCategory.toLowerCase()));

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">技能库</h2>
          <p className="text-sm text-gray-500">选择一个技能开始对话</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="关闭"
        >
          <Settings className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索技能..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="px-6 py-3 border-b border-gray-100">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map(category => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === category.id
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Skills List */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">加载中...</div>
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Search className="w-12 h-12 mb-3 opacity-50" />
            <p>没有找到匹配的技能</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSkills.map(skill => (
              <div
                key={skill.name}
                className="p-4 border border-gray-200 rounded-xl hover:border-primary hover:shadow-md transition-all cursor-pointer bg-white"
                onClick={() => onSkillSelect(skill.name)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{skill.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <span>v{skill.version}</span>
                        <span>•</span>
                        <span className="text-primary">{skill.type}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {skill.description}
                </p>

                {skill.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {skill.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                      >
                        {tag}
                      </span>
                    ))}
                    {skill.tags.length > 3 && (
                      <span className="text-xs text-gray-400">+{skill.tags.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <button
          onClick={() => {/* TODO: Open skill creator */}}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          创建新技能
        </button>
      </div>
    </div>
  );
}
