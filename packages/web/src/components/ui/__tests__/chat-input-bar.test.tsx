import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChatInputBar } from '../chat-input-bar';

describe('ChatInputBar', () => {
  it('keeps upload button clickable when message input is disabled', () => {
    const onUpload = vi.fn();

    render(
      <ChatInputBar
        onSubmit={vi.fn()}
        disabled
        isGenerating
        onUpload={onUpload}
      />,
    );

    fireEvent.click(screen.getByTitle('上传文件'));

    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it('disables upload button while upload is in progress', () => {
    const onUpload = vi.fn();

    render(
      <ChatInputBar
        onSubmit={vi.fn()}
        onUpload={onUpload}
        uploading
      />,
    );

    fireEvent.click(screen.getByTitle('上传文件'));

    expect(onUpload).not.toHaveBeenCalled();
  });
});
