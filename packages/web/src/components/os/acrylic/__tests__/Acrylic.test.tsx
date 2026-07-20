/**
 * OS.5: Acrylic Components Tests
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import AcrylicPanel from '@/components/os/acrylic/AcrylicPanel';
import AcrylicDialog from '@/components/os/acrylic/AcrylicDialog';

describe('AcrylicPanel', () => {
  it('should render children', () => {
    render(<AcrylicPanel>Test Content</AcrylicPanel>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should apply variant styles using CSS classes', () => {
    const { container } = render(<AcrylicPanel variant="strong">Content</AcrylicPanel>);
    // Check for CSS class instead of inline Tailwind styles
    expect(container.firstChild).toHaveClass('acrylic-panel');
    expect(container.firstChild).toHaveClass('acrylic-panel--strong');
  });

  it('should apply standard variant by default', () => {
    const { container } = render(<AcrylicPanel>Content</AcrylicPanel>);
    expect(container.firstChild).toHaveClass('acrylic-panel');
  });

  it('should apply subtle variant', () => {
    const { container } = render(<AcrylicPanel variant="subtle">Content</AcrylicPanel>);
    expect(container.firstChild).toHaveClass('acrylic-panel');
    expect(container.firstChild).toHaveClass('acrylic-panel--subtle');
  });

  it('should apply custom className', () => {
    const { container } = render(<AcrylicPanel className="custom-class">Content</AcrylicPanel>);
    expect(container.firstChild).toHaveClass('custom-class');
    expect(container.firstChild).toHaveClass('acrylic-panel');
  });
});

describe('AcrylicDialog', () => {
  it('should not render when closed', () => {
    render(<AcrylicDialog isOpen={false} onClose={vi.fn()}>Content</AcrylicDialog>);
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should render when open', async () => {
    render(<AcrylicDialog isOpen={true} onClose={vi.fn()}>Content</AcrylicDialog>);
    // Wait for animation to start
    await waitFor(() => {
      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });

  it('should render title', async () => {
    render(<AcrylicDialog isOpen={true} onClose={vi.fn()} title="Test Title">Content</AcrylicDialog>);
    await waitFor(() => {
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });
  });

  it('should call onClose when clicking close button', async () => {
    const onClose = vi.fn();
    render(<AcrylicDialog isOpen={true} onClose={onClose} title="Title">Content</AcrylicDialog>);

    await waitFor(() => {
      expect(screen.getByLabelText('Close dialog')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText('Close dialog'));
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose on Escape key after animation completes', async () => {
    const onClose = vi.fn();
    render(<AcrylicDialog isOpen={true} onClose={onClose}>Content</AcrylicDialog>);

    // Wait for the dialog to be visible (animation state)
    await waitFor(() => {
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    // Small delay to let the visibility state update
    await new Promise(resolve => setTimeout(resolve, 50));

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('should not close on Escape when closeOnEsc is false', async () => {
    const onClose = vi.fn();
    render(<AcrylicDialog isOpen={true} onClose={onClose} closeOnEsc={false}>Content</AcrylicDialog>);

    await waitFor(() => {
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should render actions', async () => {
    render(
      <AcrylicDialog isOpen={true} onClose={vi.fn()} actions={<button>Action</button>}>
        Content
      </AcrylicDialog>
    );
    await waitFor(() => {
      expect(screen.getByText('Action')).toBeInTheDocument();
    });
  });

  it('should have animation classes when opened', async () => {
    render(<AcrylicDialog isOpen={true} onClose={vi.fn()}>Content</AcrylicDialog>);

    await waitFor(() => {
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    // Check for animation class on the panel (portal renders to body)
    const panels = document.querySelectorAll('.acrylic-panel');
    expect(panels.length).toBeGreaterThan(0);
    // Animation class should be either enter or exit depending on timing
    // Updated to use Fluent animation classes (fluent-enter/fluent-exit)
    const hasAnimation = panels[0]!.classList.contains('fluent-enter') ||
                         panels[0]!.classList.contains('fluent-exit');
    expect(hasAnimation).toBe(true);
  });

  it('should render in nonModal mode by default', async () => {
    render(<AcrylicDialog isOpen={true} onClose={vi.fn()}>Content</AcrylicDialog>);

    await waitFor(() => {
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    // Should not have overlay in nonModal mode
    expect(screen.queryByTestId('acrylic-overlay')).not.toBeInTheDocument();
  });

  it('should render overlay in modal mode', async () => {
    render(<AcrylicDialog isOpen={true} onClose={vi.fn()} mode="modal">Content</AcrylicDialog>);

    await waitFor(() => {
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    // Should have overlay in modal mode
    const overlay = document.querySelector('.acrylic-overlay');
    expect(overlay).toBeInTheDocument();
  });

  // ARIA accessibility tests
  it('should have role="dialog" for accessibility', async () => {
    render(<AcrylicDialog isOpen={true} onClose={vi.fn()} title="Dialog Title">Content</AcrylicDialog>);

    await waitFor(() => {
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeInTheDocument();
  });

  it('should have aria-modal="true" in modal mode', async () => {
    render(<AcrylicDialog isOpen={true} onClose={vi.fn()} mode="modal" title="Modal">Content</AcrylicDialog>);

    await waitFor(() => {
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('should not have aria-modal in nonModal mode', async () => {
    render(<AcrylicDialog isOpen={true} onClose={vi.fn()} mode="nonModal" title="Non-Modal">Content</AcrylicDialog>);

    await waitFor(() => {
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toHaveAttribute('aria-modal');
  });

  it('should have aria-labelledby associated with title', async () => {
    render(<AcrylicDialog isOpen={true} onClose={vi.fn()} title="Test Title">Content</AcrylicDialog>);

    await waitFor(() => {
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    const dialog = document.querySelector('[role="dialog"]');
    const labelledBy = dialog?.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();

    const titleElement = document.getElementById(labelledBy!);
    expect(titleElement).toHaveTextContent('Test Title');
  });

  it('should have aria-describedby for content', async () => {
    render(<AcrylicDialog isOpen={true} onClose={vi.fn()} title="Title">Content</AcrylicDialog>);

    await waitFor(() => {
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    const dialog = document.querySelector('[role="dialog"]');
    const describedBy = dialog?.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();

    const contentElement = document.getElementById(describedBy!);
    expect(contentElement).toHaveTextContent('Content');
  });

  it('should have tabIndex={-1} for focus management', async () => {
    render(<AcrylicDialog isOpen={true} onClose={vi.fn()} mode="modal" title="Modal">Content</AcrylicDialog>);

    await waitFor(() => {
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toHaveAttribute('tabindex', '-1');
  });

  it('should have accessible close button', async () => {
    render(<AcrylicDialog isOpen={true} onClose={vi.fn()} title="Title">Content</AcrylicDialog>);

    await waitFor(() => {
      expect(screen.getByLabelText('Close dialog')).toBeInTheDocument();
    });
  });
});
