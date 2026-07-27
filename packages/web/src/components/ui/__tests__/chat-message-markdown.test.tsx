import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MarkdownContent } from '../chat-message';

vi.mock('../MermaidDiagram', () => ({
  MermaidDiagram: () => <div data-testid="mermaid-diagram" />,
}));

describe('MarkdownContent tables', () => {
  it('renders a recoverable model-generated table as an HTML table', () => {
    const { container } = render(
      <MarkdownContent
        content={[
          '评估结果：',
          '| 项目 | 结论 |',
          '| - | - |',
          '| 匹配度 | 高 |',
        ].join('\n')}
      />,
    );

    expect(container.querySelector('table')).not.toBeNull();
    expect(screen.getByRole('columnheader', { name: '项目' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '高' })).toBeTruthy();
  });
});
