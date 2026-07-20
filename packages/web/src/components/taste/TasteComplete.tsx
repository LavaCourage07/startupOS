/**
 * Story C.1: TasteComplete - 完成界面组件
 *
 * 功能:
 * - 显示品味检测完成信息
 * - TASTE Profile 预览 (可选展开)
 * - 进入主系统按钮
 * - 编辑/重新检测选项
 *
 * @module components/taste/TasteComplete
 */

'use client';

import React, { useState } from 'react';
import type { TASTEProfile } from '@originos/core/types';

// ============================================================================
// Types
// ============================================================================

export interface TasteCompleteProps {
  /** 生成的 TASTE Profile */
  tasteProfile: TASTEProfile;
  /** 完成按钮点击回调 */
  onComplete: () => void;
  /** 是否显示详细预览 */
  showDetails?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export default function TasteComplete({
  tasteProfile,
  onComplete,
  showDetails: initialShowDetails = false,
}: TasteCompleteProps) {
  const [showDetails, setShowDetails] = useState(initialShowDetails);

  // Calculate confidence percentage
  const confidencePercent = Math.round((tasteProfile.metadata?.confidence ?? 0.5) * 100);

  // Get top experience domains
  const topDomains = tasteProfile.experience_topology?.slice(0, 3) || [];

  // Get taste standards summary
  const tasteStandardsEntries = Object.entries(tasteProfile.taste_standards || {}).slice(0, 2);

  return (
    <div className="flex flex-col h-full">
      {/* Success Header */}
      <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center animate-scale-in">
          <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Title */}
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          太棒了! 我了解你的风格了
        </h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-md">
          通过我们的对话, 我已经创建了你的个人品味档案。
          这将帮助我更好地为你服务。
        </p>

        {/* Confidence Badge */}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">置信度</span>
          <div className="flex items-center gap-1">
            <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-1000"
                style={{ width: `${confidencePercent}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {confidencePercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Profile Summary Card */}
      <div className="flex-1 px-6 pb-6 overflow-y-auto">
        <div className="bg-white/30 dark:bg-black/10 rounded-xl p-4 border border-white/30 dark:border-white/10">
          {/* Experience Domains */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              经验领域
            </h4>
            <div className="flex flex-wrap gap-2">
              {topDomains.length > 0 ? (
                topDomains.map((domain, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium"
                  >
                    {domain}
                  </span>
                ))
              ) : (
                <span className="text-gray-400 dark:text-gray-500 text-sm">
                  暂无数据
                </span>
              )}
            </div>
          </div>

          {/* Taste Standards Preview */}
          {tasteStandardsEntries.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                品味标准
              </h4>
              <div className="space-y-2">
                {tasteStandardsEntries.map(([domain, standards]) => (
                  <div key={domain} className="text-sm">
                    <span className="text-gray-600 dark:text-gray-400 font-medium capitalize">
                      {domain}:
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {standards.positive_vibes?.slice(0, 2).map((vibe, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs"
                        >
                          + {vibe}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Toggle Details Button */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center justify-center gap-1 transition-colors"
          >
            {showDetails ? '收起详情' : '查看完整档案'}
            <svg
              className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Detailed Profile View */}
          {showDetails && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4 animate-fade-in">
              {/* Tension Position */}
              {tasteProfile.tension_position && (
                <div>
                  <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    张力位置
                  </h5>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                      <div className="text-gray-500 dark:text-gray-400">控制</div>
                      <div className="font-medium text-gray-700 dark:text-gray-300">
                        {Math.round(tasteProfile.tension_position.control_level * 100)}%
                      </div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                      <div className="text-gray-500 dark:text-gray-400">信任</div>
                      <div className="font-medium text-gray-700 dark:text-gray-300">
                        {Math.round(tasteProfile.tension_position.trust_level * 100)}%
                      </div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                      <div className="text-gray-500 dark:text-gray-400">介入</div>
                      <div className="font-medium text-gray-700 dark:text-gray-300">
                        {Math.round(tasteProfile.tension_position.intervention_threshold * 100)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Symbiosis Boundary */}
              {tasteProfile.symbiosis_boundary && (
                <div>
                  <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    共生边界
                  </h5>
                  <div className="space-y-2 text-xs">
                    {tasteProfile.symbiosis_boundary.delegated_domains?.length > 0 && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">委托领域: </span>
                        <span className="text-gray-700 dark:text-gray-300">
                          {tasteProfile.symbiosis_boundary.delegated_domains.join(', ')}
                        </span>
                      </div>
                    )}
                    {tasteProfile.symbiosis_boundary.reserved_domains?.length > 0 && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">保留领域: </span>
                        <span className="text-gray-700 dark:text-gray-300">
                          {tasteProfile.symbiosis_boundary.reserved_domains.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="text-xs text-gray-400 dark:text-gray-500">
                <p>档案版本: {tasteProfile.version}</p>
                <p>创建时间: {new Date(tasteProfile.createdAt).toLocaleString('zh-CN')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-6 py-4 border-t border-white/10 space-y-3">
        <button
          onClick={onComplete}
          className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          进入 OriginOS
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          你随时可以在设置中更新你的品味档案
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Animation Styles (add to global CSS)
// ============================================================================

// @keyframes scale-in {
//   from {
//     transform: scale(0.8);
//     opacity: 0;
//   }
//   to {
//     transform: scale(1);
//     opacity: 1;
//   }
// }
//
// .animate-scale-in {
//   animation: scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
// }
