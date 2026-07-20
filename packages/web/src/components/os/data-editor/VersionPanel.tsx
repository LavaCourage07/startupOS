'use client';

import { useState } from 'react';

interface VersionInfo {
	version: number;
	label?: string;
	savedAt: number;
}

interface VersionPanelProps {
	versions: VersionInfo[];
	currentVersion: number;
	onRevert: (version: number) => void;
	onSaveVersion: (label?: string) => void;
	isLoading?: boolean;
}

export function VersionPanel({ versions, currentVersion, onRevert, onSaveVersion, isLoading }: VersionPanelProps) {
	const [label, setLabel] = useState('');

	const handleSave = () => {
		onSaveVersion(label.trim() || undefined);
		setLabel('');
	};

	return (
		<div className="flex flex-col h-full text-sm">
			<div className="px-3 py-2 border-b border-gray-200 bg-gray-50 font-medium">
				版本历史
				<span className="ml-2 text-xs text-gray-400">v{currentVersion}</span>
			</div>

			<div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
				<input
					type="text"
					value={label}
					onChange={(e) => setLabel(e.target.value)}
					placeholder="版本标签（可选）"
					className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
					onKeyDown={(e) => e.key === 'Enter' && handleSave()}
				/>
				<button
					onClick={handleSave}
					disabled={isLoading}
					className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
				>
					保存快照
				</button>
			</div>

			<div className="flex-1 overflow-auto">
				{isLoading ? (
					<div className="px-3 py-4 text-xs text-gray-400">加载中...</div>
				) : versions.length === 0 ? (
					<div className="px-3 py-4 text-xs text-gray-400">暂无版本记录</div>
				) : (
					<ul className="divide-y divide-gray-100">
						{versions.map((v) => (
							<li key={v.version} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className={`text-xs font-medium ${v.version === currentVersion ? 'text-blue-600' : 'text-gray-600'}`}>
											v{v.version}
										</span>
										{v.version === currentVersion && <span className="text-xs text-blue-500">当前</span>}
									</div>
									{v.label && <div className="text-xs text-gray-500 truncate">{v.label}</div>}
									<div className="text-xs text-gray-400">{formatTime(v.savedAt)}</div>
								</div>
								{v.version !== currentVersion && (
									<button
										onClick={() => onRevert(v.version)}
										className="ml-2 px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
									>
										回退
									</button>
								)}
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

function formatTime(timestamp: number): string {
	if (!timestamp) return '';
	const d = new Date(timestamp);
	const pad = (n: number) => n.toString().padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
