'use client';

import { useState, useCallback, useMemo } from 'react';
import {
	useReactTable,
	getCoreRowModel,
	getSortedRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	flexRender,
	type ColumnDef,
	type SortingState,
} from '@tanstack/react-table';
import type { InstanceData, ConceptField } from '@originos/core/lib/features/ontology-data-store/types';

interface DataTableViewProps {
	fields: ConceptField[];
	instances: InstanceData[];
	onSelect: (instance: InstanceData) => void;
	onDelete?: (ids: string[]) => void;
	onCellEdit?: (instanceId: string, fieldName: string, value: unknown) => void;
	isLoading?: boolean;
}

export function DataTableView({ fields, instances, onSelect, onDelete, onCellEdit, isLoading }: DataTableViewProps) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [globalFilter, setGlobalFilter] = useState('');
	const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
	const [editingCell, setEditingCell] = useState<{ rowId: string; fieldIndex: number; value: string } | null>(null);

	const handleCellDoubleClick = useCallback((rowId: string, fieldIndex: number, currentValue: unknown) => {
		if (!onCellEdit) return;
		const strValue = currentValue === null || currentValue === undefined ? '' : String(currentValue);
		setEditingCell({ rowId, fieldIndex, value: strValue });
	}, [onCellEdit]);

	const handleCellSave = useCallback(() => {
		if (!editingCell || !onCellEdit) return;
		const field = fields[editingCell.fieldIndex];
		if (!field) return;
		let value: unknown = editingCell.value;
		if (field.type === 'number') value = editingCell.value === '' ? undefined : Number(editingCell.value);
		else if (field.type === 'boolean') value = editingCell.value.toLowerCase() === 'true';
		else if (field.type === 'array') value = editingCell.value.split('\n').filter(Boolean);
		onCellEdit(editingCell.rowId, field.name, value);
		setEditingCell(null);
	}, [editingCell, onCellEdit, fields]);

	const handleCellKeyDown = useCallback((e: React.KeyboardEvent) => {
		if (e.key === 'Enter') handleCellSave();
		else if (e.key === 'Escape') setEditingCell(null);
	}, [handleCellSave]);

	const columns = useMemo<ColumnDef<InstanceData, unknown>[]>(() => {
		const cols: ColumnDef<InstanceData, unknown>[] = [];

		for (const field of fields) {
			const fieldIndex = fields.indexOf(field);
			cols.push({
				accessorKey: `fields.${field.name}`,
				header: field.name,
				enableSorting: true,
				enableColumnFilter: true,
				filterFn: 'auto',
				cell: ({ getValue, row }) => {
					const val = getValue();
					const isEditing = editingCell?.rowId === row.original.id && editingCell?.fieldIndex === fieldIndex;
					if (isEditing) {
						return (
							<input
								autoFocus
								value={editingCell.value}
								onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
								onKeyDown={handleCellKeyDown}
								onBlur={handleCellSave}
								className="w-full px-1 py-0.5 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
							/>
						);
					}
					return (
						<div
							onDoubleClick={() => handleCellDoubleClick(row.original.id, fieldIndex, val)}
							className="cursor-text min-h-[1.5rem] px-1 py-0.5"
						>
							{renderCellValue(val)}
						</div>
					);
				},
			});
		}

		// Actions column
		cols.push({
			id: 'actions',
			header: '操作',
			cell: ({ row }) => (
				<button
					onClick={() => onSelect(row.original)}
					className="text-xs text-blue-600 hover:text-blue-800"
				>
					编辑
				</button>
			),
			enableSorting: false,
			enableColumnFilter: false,
		});

		return cols;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fields, onSelect, editingCell, handleCellDoubleClick, handleCellKeyDown, handleCellSave]);

	const table = useReactTable({
		data: instances,
		columns,
		state: { sorting, globalFilter, rowSelection },
		onSortingChange: setSorting,
		onGlobalFilterChange: setGlobalFilter,
		onRowSelectionChange: setRowSelection,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		enableRowSelection: true,
	});

	const selectedIds = useMemo(
		() => table.getFilteredSelectedRowModel().rows.map((r) => r.original.id),
		[table]
	);

	const handleDeleteSelected = useCallback(() => {
		if (selectedIds.length === 0 || !onDelete) return;
		if (!confirm(`确定删除选中的 ${selectedIds.length} 条记录？`)) return;
		onDelete(selectedIds);
		table.resetRowSelection();
	}, [selectedIds, onDelete, table]);

	return (
		<div className="flex flex-col h-full">
			{/* Toolbar */}
			<div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
				<input
					type="text"
					value={globalFilter}
					onChange={(e) => setGlobalFilter(e.target.value)}
					placeholder="搜索..."
					className="px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
				<div className="flex items-center gap-2">
					{selectedIds.length > 0 && (
						<span className="text-xs text-gray-500">已选择 {selectedIds.length} 条</span>
					)}
					{onDelete && selectedIds.length > 0 && (
						<button
							onClick={handleDeleteSelected}
							className="px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
						>
							删除选中
						</button>
					)}
				</div>
			</div>

			{/* Table */}
			<div className="flex-1 overflow-auto">
				{isLoading ? (
					<div className="flex items-center justify-center h-full text-sm text-gray-400">加载中...</div>
				) : instances.length === 0 ? (
					<div className="flex items-center justify-center h-full text-sm text-gray-400">暂无数据</div>
				) : (
					<table className="w-full text-sm border-collapse">
						<thead className="sticky top-0 bg-gray-50 z-10">
							{table.getHeaderGroups().map((headerGroup) => (
								<tr key={headerGroup.id}>
									<th className="w-10 px-2 py-2 border-b border-gray-200">
										<input
											type="checkbox"
											checked={table.getIsAllRowsSelected()}
											onChange={table.getToggleAllRowsSelectedHandler()}
											className="h-3 w-3"
										/>
									</th>
									{headerGroup.headers.map((header) => (
										<th
											key={header.id}
											onClick={header.column.getToggleSortingHandler()}
											className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200 cursor-pointer select-none hover:bg-gray-100"
										>
											{flexRender(header.column.columnDef.header, header.getContext())}
											<span className="ml-1 text-xs text-gray-400">
												{header.column.getIsSorted()
													? header.column.getIsSorted() === 'asc' ? '↑' : '↓'
													: ''}
											</span>
										</th>
									))}
								</tr>
							))}
						</thead>
						<tbody>
							{table.getRowModel().rows.map((row) => (
								<tr
									key={row.id}
									className={`hover:bg-gray-50 transition-colors ${row.getIsSelected() ? 'bg-blue-50' : ''}`}
								>
									<td className="px-2 py-1.5 border-b border-gray-100">
										<input
											type="checkbox"
											checked={row.getIsSelected()}
											onChange={row.getToggleSelectedHandler()}
											className="h-3 w-3"
										/>
									</td>
									{row.getVisibleCells().map((cell) => (
										<td key={cell.id} className="px-3 py-1.5 border-b border-gray-100">
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>

			{/* Pagination */}
			{instances.length > 0 && (
				<div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50">
					<div className="flex items-center gap-2">
						<button
							onClick={() => table.previousPage()}
							disabled={!table.getCanPreviousPage()}
							className="px-2 py-1 text-xs rounded border border-gray-300 disabled:opacity-50 transition-colors"
						>
							上一页
						</button>
						<button
							onClick={() => table.nextPage()}
							disabled={!table.getCanNextPage()}
							className="px-2 py-1 text-xs rounded border border-gray-300 disabled:opacity-50 transition-colors"
						>
							下一页
						</button>
					</div>
					<div className="text-xs text-gray-500">
						第 {table.getState().pagination.pageIndex + 1} 页 / 共 {table.getPageCount()} 页
						（{table.getFilteredRowModel().rows.length} 条）
					</div>
				</div>
			)}
		</div>
	);
}

function renderCellValue(value: unknown): string {
	if (value === null || value === undefined) return '';
	if (Array.isArray(value)) return value.join(', ');
	if (typeof value === 'object') return JSON.stringify(value);
	if (typeof value === 'boolean') return value ? '是' : '否';
	if (typeof value === 'number') return String(value);
	if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
		return new Date(value).toLocaleString('zh-CN');
	}
	return String(value);
}
