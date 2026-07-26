import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EntryExportButton } from '../EntryExportButton';

const { exportWorkspaceEntry, isElectron } = vi.hoisted(() => ({
  exportWorkspaceEntry: vi.fn(),
  isElectron: vi.fn(() => true),
}));

vi.mock('@originos/core/lib/integrations/electron/services/workspace', () => ({
  exportWorkspaceEntry,
}));

vi.mock('@originos/core/lib/integrations/electron/env', () => ({
  isElectron,
}));

describe('EntryExportButton', () => {
  beforeEach(() => {
    exportWorkspaceEntry.mockReset();
    isElectron.mockReturnValue(true);
  });

  it('exports the requested entry and disables duplicate clicks while pending', async () => {
    let resolveExport: ((value: unknown) => void) | undefined;
    exportWorkspaceEntry.mockReturnValue(new Promise((resolve) => {
      resolveExport = resolve;
    }));

    render(<EntryExportButton entryType="role-agent" entryId="product-manager" />);
    const button = screen.getByRole('button', { name: '导出 ZIP' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(exportWorkspaceEntry).toHaveBeenCalledTimes(1);
    expect(exportWorkspaceEntry).toHaveBeenCalledWith({
      entryType: 'role-agent',
      entryId: 'product-manager',
    });

    resolveExport?.({
      success: true,
      data: { zipPath: 'data/agents/product-manager.zip' },
      timestamp: new Date().toISOString(),
    });
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it('shows a recoverable error returned by the main process', async () => {
    exportWorkspaceEntry.mockResolvedValue({
      success: false,
      error: { code: 'ENTRY_NOT_FOUND', message: 'Entry work directory does not exist' },
      timestamp: new Date().toISOString(),
    });

    render(<EntryExportButton entryType="skill" entryId="missing-skill" />);
    fireEvent.click(screen.getByRole('button', { name: '导出 ZIP' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '导出失败：Entry work directory does not exist',
    );
    expect(screen.getByRole('button', { name: '导出 ZIP' })).not.toBeDisabled();
  });

  it('does not render outside Electron', () => {
    isElectron.mockReturnValue(false);
    const { container } = render(
      <EntryExportButton entryType="agent" entryId="assistant" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
