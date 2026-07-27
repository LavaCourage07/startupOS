import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MarkdownContent, STREAMING_PLAIN_TEXT_THRESHOLD } from '../chat-message';

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

  it('uses the low-cost plain-text renderer for long streaming content', () => {
    const content = `# report\n${'long content '.repeat(STREAMING_PLAIN_TEXT_THRESHOLD / 10)}`;
    const { container } = render(
      <MarkdownContent content={content} isStreaming />,
    );

    expect(container.querySelector('[data-stream-renderer="plain-text"]')).not.toBeNull();
    expect(container.querySelector('h1')).toBeNull();
  });

  it('renders full markdown once the long stream completes', () => {
    const content = `# Final report\n${'body '.repeat(STREAMING_PLAIN_TEXT_THRESHOLD / 4)}`;
    const { container, rerender } = render(
      <MarkdownContent content={content} isStreaming />,
    );

    expect(container.querySelector('h1')).toBeNull();
    rerender(<MarkdownContent content={content} isStreaming={false} />);
    expect(screen.getByRole('heading', { name: 'Final report' })).toBeTruthy();
    expect(container.querySelector('[data-stream-renderer="plain-text"]')).toBeNull();
  });
});
