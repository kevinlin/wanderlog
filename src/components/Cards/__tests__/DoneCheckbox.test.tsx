import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DoneCheckbox } from '../DoneCheckbox';

describe('DoneCheckbox', () => {
  it('reports the new state when ticked', async () => {
    const onToggle = vi.fn();
    render(<DoneCheckbox ariaLabel="Mark done" checked={false} onToggle={onToggle} />);

    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'Mark done' }));

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('is disabled and ignores clicks when disabled', async () => {
    const onToggle = vi.fn();
    render(<DoneCheckbox ariaLabel="Mark done" checked={false} disabled onToggle={onToggle} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Mark done' });
    await userEvent.setup().click(checkbox);

    expect(checkbox).toBeDisabled();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('stays enabled by default', () => {
    render(<DoneCheckbox ariaLabel="Mark done" checked={false} onToggle={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: 'Mark done' })).toBeEnabled();
  });
});
