/**
 * OS.7: Agent Host Components Tests
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import AgentIcon from '@/components/os/agent-host/AgentIcon';
import _AgentDialog from '@/components/os/agent-host/AgentDialog';
import MessageList from '@/components/os/agent-host/MessageList';
import MessageInput from '@/components/os/agent-host/MessageInput';
import { AgentHost, AgentMessage, AgentStatus } from '@originos/core/types';

vi.mock('@/store/agentHostStore');

describe('AgentIcon', () => {
  const mockAgent: AgentHost = {
    id: 'test-agent',
    name: 'Test Agent',
    icon: '🤖',
  };

  it('should render agent icon', () => {
    render(<AgentIcon agent={mockAgent} />);
    expect(screen.getByText('🤖')).toBeInTheDocument();
  });

  it('should call onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<AgentIcon agent={mockAgent} onClick={onClick} />);

    await userEvent.click(screen.getByText('🤖'));
    expect(onClick).toHaveBeenCalled();
  });

  it('should show status indicator', () => {
    const { container } = render(<AgentIcon agent={mockAgent} status={AgentStatus.RUNNING} />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});

describe('MessageList', () => {
  const mockMessages: AgentMessage[] = [
    { id: 'msg-1', role: 'user', content: 'Hello', timestamp: Date.now() },
    { id: 'msg-2', role: 'assistant', content: 'Hi there!', timestamp: Date.now() },
  ];

  it('should render messages', () => {
    render(<MessageList messages={mockMessages} agentId="test" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });
});

describe('MessageInput', () => {
  it('should call onSend when Enter is pressed', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<MessageInput onSend={onSend} />);

    const input = screen.getByPlaceholderText('输入消息...');
    await userEvent.type(input, 'Test message{Enter}');

    expect(onSend).toHaveBeenCalledWith('Test message');
  });

  it('should clear input after sending', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<MessageInput onSend={onSend} />);

    const input = screen.getByPlaceholderText('输入消息...') as HTMLInputElement;
    await userEvent.type(input, 'Test{Enter}');

    expect(input.value).toBe('');
  });
});
