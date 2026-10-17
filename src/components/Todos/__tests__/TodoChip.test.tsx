import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TodoChip } from '../TodoChip';

const TODAY = '2026-12-05';

const chip = (todo: { done?: boolean; due_on?: string; opens_on?: string }, lead?: string) =>
  render(<TodoChip lead={lead} today={TODAY} todo={{ done: false, ...todo }} />);

describe('TodoChip', () => {
  it('says when a ready todo is due', () => {
    chip({ opens_on: '2026-12-01', due_on: '2026-12-15' });

    expect(screen.getByText('Ready · by 15 Dec')).toBeInTheDocument();
  });

  it('says "Ready now" when there is no deadline', () => {
    chip({ opens_on: '2026-12-01' });

    expect(screen.getByText('Ready now')).toBeInTheDocument();
  });

  it('is still ready on the day it is due', () => {
    chip({ due_on: TODAY });

    expect(screen.getByText('Ready · by 5 Dec')).toBeInTheDocument();
  });

  it('spells out "Overdue" and the missed day', () => {
    chip({ due_on: '2026-12-02' });

    expect(screen.getByText('Overdue · was due 2 Dec')).toBeInTheDocument();
  });

  it('says when an upcoming todo opens', () => {
    chip({ opens_on: '2026-12-09' });

    expect(screen.getByText('Opens 9 Dec')).toBeInTheDocument();
  });

  it('renders nothing for a done todo', () => {
    const { container } = chip({ done: true, due_on: '2026-12-02' });

    expect(container).toBeEmptyDOMElement();
  });

  it('puts the lead marker in front of the text, hidden from screen readers', () => {
    chip({ due_on: '2026-12-15' }, '🎟');

    expect(screen.getByText('🎟')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Ready · by 15 Dec')).toBeInTheDocument();
  });
});
