'use client';

import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { InstanceData } from '@originos/core/lib/features/ontology-data-store/types';

interface DataDocumentViewProps {
	instance: InstanceData;
	onChange: (fields: Record<string, unknown>) => void;
	onSave: () => void;
	isSaving?: boolean;
}

export function DataDocumentView({ instance, onChange, onSave, isSaving }: DataDocumentViewProps) {
	const [content, setContent] = useState('');
	const [hasUnsaved, setHasUnsaved] = useState(false);
	const [editing, setEditing] = useState(false);

	useEffect(() => {
		const md = instanceToMarkdown(instance);
		setContent(md);
		setHasUnsaved(false);
	}, [instance]);

	const handleContentChange = (newContent: string) => {
		setContent(newContent);
		setHasUnsaved(newContent !== instanceToMarkdown(instance));
	};

	const handleSave = useCallback(async () => {
		const fields = markdownToFields(content, instance.fields);
		onChange(fields);
		await onSave();
		setHasUnsaved(false);
		setEditing(false);
	}, [content, instance.fields, onChange, onSave]);

	return (
		<div className="flex flex-col h-full">
			{/* Toolbar */}
			<div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
				<div className="flex items-center space-x-2">
					<button
						onClick={() => setEditing(!editing)}
						className={`px-3 py-1 text-sm rounded transition-colors ${editing ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}
					>
						{editing ? '编辑模式' : '预览模式'}
					</button>
				</div>
				<div className="flex items-center space-x-3">
					{hasUnsaved && <span className="text-xs text-orange-600">● 未保存</span>}
					{isSaving && <span className="text-xs text-gray-500">保存中...</span>}
					<button
						onClick={handleSave}
						disabled={!hasUnsaved || isSaving}
						className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						保存
					</button>
				</div>
			</div>

			<div className="flex-1 overflow-auto">
				{editing ? (
					<textarea
						value={content}
						onChange={(e) => handleContentChange(e.target.value)}
						className="w-full h-full p-4 font-mono text-sm bg-transparent resize-none focus:outline-none"
					/>
				) : (
					<div className="p-4 prose prose-sm max-w-none">
						<ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
					</div>
				)}
			</div>
		</div>
	);
}

function instanceToMarkdown(instance: InstanceData): string {
	const lines = [`# ${instance.fields['name'] ?? instance.id}`, ''];
	for (const [key, value] of Object.entries(instance.fields)) {
		if (key === 'name') continue;
		const display = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
		lines.push(`## ${key}`, '', display, '');
	}
	return lines.join('\n');
}

function markdownToFields(markdown: string, existingFields: Record<string, unknown>): Record<string, unknown> {
	const fields = { ...existingFields };
	const currentHeading = markdown.match(/^# (.+)$/m)?.[1];
	if (currentHeading && fields['name'] !== undefined) {
		fields['name'] = currentHeading;
	}

	const sections = markdown.split(/^## /m).slice(1);
	for (const section of sections) {
		const newlineIdx = section.indexOf('\n');
		if (newlineIdx === -1) continue;
		const fieldName = section.slice(0, newlineIdx).trim();
		const fieldValue = section.slice(newlineIdx).trim();
		if (fieldName && Object.prototype.hasOwnProperty.call(existingFields, fieldName)) {
			const existing = existingFields[fieldName];
			if (typeof existing === 'number') {
				const num = Number(fieldValue);
				fields[fieldName] = isNaN(num) ? existing : num;
			} else if (typeof existing === 'boolean') {
				fields[fieldName] = fieldValue.toLowerCase() === 'true';
			} else {
				fields[fieldName] = fieldValue;
			}
		}
	}

	return fields;
}
