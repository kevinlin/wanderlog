import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TodoButton } from '../TodoButton';

describe('TodoButton', () => {
  it('names itself with the ready count', () => {
    render(<TodoButton count={3} isOpen={false} onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'To do, 3 ready' })).toBeInTheDocument();
  });

  it('shows the count on a badge', () => {
    render(<TodoButton count={3} isOpen={false} onClick={vi.fn()} />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('is just "To do", with no number, when nothing is ready', () => {
    render(<TodoButton count={0} isOpen={false} onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'To do' })).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('hides its text label below the sm breakpoint so only the icon shows', () => {
    render(<TodoButton count={0} isOpen={false} onClick={vi.fn()} />);

    expect(screen.getByText('To do')).toHaveClass('hidden', 'sm:inline');
  });

  it('keeps a 44px touch target', () => {
    render(<TodoButton count={0} isOpen={false} onClick={vi.fn()} />);

    expect(screen.getByRole('button')).toHaveClass('min-h-11', 'min-w-11');
  });

  it('reports whether the list is open', () => {
    const { rerender } = render(<TodoButton count={0} isOpen={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');

    rerender(<TodoButton count={0} isOpen onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('calls onClick when pressed', async () => {
    const onClick = vi.fn();
    render(<TodoButton count={0} isOpen={false} onClick={onClick} />);

    await userEvent.setup().click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
