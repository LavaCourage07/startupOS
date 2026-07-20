'use client';

import { useState, useCallback } from 'react';
import type { InstanceData, ConceptSchema } from '@originos/core/lib/features/ontology-data-store/types';
import { DataFormView } from './DataFormView';
import { DataDocumentView } from './DataDocumentView';
import { VersionPanel } from './VersionPanel';

type DataEditMode = 'form' | 'document' | 'version';

interface VersionInfo {
	version: number;
	label?: string;
	savedAt: number;
}

interface DataWindowContentProps {
	instance: InstanceData;
	schema: ConceptSchema;
	onSave: (fields: Record<string, unknown>) => Promise<void>;
	onRevert: (version: number) => void;
	onSaveVersion: (label?: string) => Promise<void>;
	versions: VersionInfo[];
	isSaving?: boolean;
	isLoadingVersions?: boolean;
}

export function DataWindowContent({
	instance,
	schema,
	onSave,
	onRevert,
	onSaveVersion,
	versions,
	isSaving,
	isLoadingVersions,
}: DataWindowContentProps) {
	const [mode, setMode] = useState<DataEditMode>('form');

	const handleFormSave = useCallback(
		(values: Record<string, unknown>) => onSave(values),
		[onSave]
	);

	const handleDocumentSave = useCallback(
		(fields: Record<string, unknown>) => onSave(fields),
		[onSave]
	);

	return (
		<div className="flex h-full">
			{/* Main content area */}
			<div className="flex-1 flex flex-col min-w-0">
				{/* View switcher */}
				<div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 bg-gray-50">
					<ModeButton label="表单" active={mode === 'form'} onClick={() => setMode('form')} />
					<ModeButton label="文档" active={mode === 'document'} onClick={() => setMode('document')} />
					<ModeButton label="版本" active={mode === 'version'} onClick={() => setMode('version')} />
				</div>

				<div className="flex-1 min-h-0">
					{mode === 'form' && (
						<DataFormView
							schema={schema}
							initialValues={instance.fields}
							onSave={handleFormSave}
							onCancel={() => {}}
							isSaving={isSaving}
						/>
					)}
					{mode === 'document' && (
						<DataDocumentView
							instance={instance}
							onChange={handleDocumentSave}
							onSave={() => {}}
							isSaving={isSaving}
						/>
					)}
					{mode === 'version' && (
						<VersionPanel
							versions={versions}
							currentVersion={instance.meta.version}
							onRevert={onRevert}
							onSaveVersion={onSaveVersion}
							isLoading={isLoadingVersions}
						/>
					)}
				</div>
			</div>
		</div>
	);
}

function ModeButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
	return (
		<button
			onClick={onClick}
			className={`px-3 py-1 text-sm rounded transition-colors ${
				active ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200 text-gray-600'
			}`}
		>
			{label}
		</button>
	);
}
