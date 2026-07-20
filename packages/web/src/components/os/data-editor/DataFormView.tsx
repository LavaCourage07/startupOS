'use client';

import { useState, useCallback } from 'react';
import type { ConceptSchema, ConceptField } from '@originos/core/lib/features/ontology-data-store/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface DataFormViewProps {
	schema: ConceptSchema;
	initialValues?: Record<string, unknown>;
	onSave: (values: Record<string, unknown>) => void;
	onCancel: () => void;
	isSaving?: boolean;
}

function renderFieldInput(field: ConceptField, value: unknown, onChange: (v: unknown) => void) {
	const commonClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-transparent';

	switch (field.type) {
		case 'boolean':
			return (
				<label className="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						checked={!!value}
						onChange={(e) => onChange(e.target.checked)}
						className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<span className="text-sm text-gray-600">是</span>
				</label>
			);

		case 'array':
			return (
				<Textarea
					value={Array.isArray(value) ? value.join('\n') : ''}
					onChange={(e) => onChange(e.target.value.split('\n').filter(Boolean))}
					className={commonClass}
					placeholder="每行一个值"
				/>
			);

		case 'object':
			return (
				<Textarea
					value={typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : ''}
					onChange={(e) => {
						try {
							onChange(e.target.value ? JSON.parse(e.target.value) : null);
						} catch {
							// invalid JSON, ignore
						}
					}}
					className={`${commonClass} font-mono`}
					placeholder='{"key": "value"}'
				/>
			);

		default:
			if (field.enum) {
				return (
					<select
						value={value as string ?? ''}
						onChange={(e) => onChange(e.target.value)}
						className={commonClass}
					>
						<option value="" className="bg-gray-900 text-white">-- 请选择 --</option>
						{field.enum.map((opt) => (
							<option key={opt} value={opt} className="bg-gray-900 text-white">{opt}</option>
						))}
					</select>
				);
			}

			if (field.type === 'date') {
				return (
					<input
						type="datetime-local"
						value={typeof value === 'number'
							? new Date(value).toISOString().slice(0, 16)
							: typeof value === 'string'
								? value.slice(0, 16)
								: ''}
						onChange={(e) => onChange(e.target.value)}
						className={commonClass}
					/>
				);
			}

			if (field.type === 'number') {
				return (
					<input
						type="number"
						value={(value as number) ?? ''}
						onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
						className={commonClass}
					/>
				);
			}

			return (
				<input
					type="text"
					value={(value as string) ?? ''}
					onChange={(e) => onChange(e.target.value)}
					className={commonClass}
				/>
			);
	}
}

export function DataFormView({ schema, initialValues = {}, onSave, onCancel, isSaving }: DataFormViewProps) {
	const [values, setValues] = useState<Record<string, unknown>>({ ...initialValues });
	const [errors, setErrors] = useState<Record<string, string>>({});

	const handleChange = useCallback((fieldName: string, value: unknown) => {
		setValues((prev) => ({ ...prev, [fieldName]: value }));
		setErrors((prev) => {
			const next = { ...prev };
			delete next[fieldName];
			return next;
		});
	}, []);

	const handleSubmit = () => {
		const newErrors: Record<string, string> = {};
		for (const field of schema.fields) {
			if (field.required && (values[field.name] === undefined || values[field.name] === null || values[field.name] === '')) {
				newErrors[field.name] = '必填';
			}
		}

		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
			return;
		}

		onSave(values);
	};

	return (
		<div className="flex flex-col h-full">
			<div className="flex-1 overflow-auto p-4 space-y-4">
				{schema.fields.map((field) => (
					<div key={field.name}>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							{field.name}
							{field.required && <span className="text-red-500 ml-1">*</span>}
							{field.description && (
								<span className="text-gray-400 font-normal ml-2 text-xs">{field.description}</span>
							)}
						</label>
						{renderFieldInput(field, values[field.name], (v) => handleChange(field.name, v))}
						{errors[field.name] && (
							<p className="mt-1 text-xs text-red-500">{errors[field.name]}</p>
						)}
					</div>
				))}
			</div>

			<div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200">
				<Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
					取消
				</Button>
				<Button size="sm" onClick={handleSubmit} disabled={isSaving}>
					{isSaving ? '保存中...' : '保存'}
				</Button>
			</div>
		</div>
	);
}
