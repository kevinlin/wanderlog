import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunAgentParams } from '@/services/agentService';

const runAgentMock = vi.fn();
vi.mock('@/services/agentService', () => ({
  runAgent: (params: RunAgentParams) => runAgentMock(params),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    session: { access_token: 'jwt', user: { email: 'kev@example.com' } },
    isLoading: false,
    signOut: vi.fn(),
  }),
}));

import { AgentModal } from '../AgentModal';

const renderModal = (props: { isOpen: boolean; onClose: () => void; tripId?: string }) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AgentModal {...props} />
      </MemoryRouter>
    </QueryClientProvider>
  );

const submitPrompt = async (prompt: string): Promise<void> => {
  await userEvent.type(screen.getByRole('textbox'), prompt);
  await userEvent.click(screen.getByRole('button', { name: /ask agent/i }));
};

describe('AgentModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submits a prompt and shows streamed progress lines', async () => {
    runAgentMock.mockImplementation(async ({ onEvent }: RunAgentParams) => {
      onEvent({ type: 'progress', message: 'Listing trips…' });
      onEvent({ type: 'result', summary: 'You have 2 trips.', answer: 'You have 2 trips.', tripId: null });
    });
    renderModal({ isOpen: true, onClose: vi.fn() });
    await submitPrompt('how many trips?');
    expect(await screen.findByText('Listing trips…')).toBeInTheDocument();
    expect(await screen.findByText('You have 2 trips.')).toBeInTheDocument();
  });

  it('shows error events in the result view', async () => {
    runAgentMock.mockImplementation(async ({ onEvent }: RunAgentParams) => {
      onEvent({ type: 'error', message: 'The AI service could not complete the request', detail: 'timeout' });
    });
    renderModal({ isOpen: true, onClose: vi.fn() });
    await submitPrompt('q');
    expect(await screen.findByText(/could not complete/i)).toBeInTheDocument();
  });

  it('shows a thrown request failure', async () => {
    runAgentMock.mockRejectedValue(new Error('Invalid or expired token'));
    renderModal({ isOpen: true, onClose: vi.fn() });
    await submitPrompt('q');
    expect(await screen.findByText('Invalid or expired token')).toBeInTheDocument();
  });

  it('resets to input state when reopened', async () => {
    runAgentMock.mockImplementation(async ({ onEvent }: RunAgentParams) => {
      onEvent({ type: 'result', summary: 'Done.', answer: 'Done.', tripId: null });
    });
    const onClose = vi.fn();
    const { rerender } = renderModal({ isOpen: true, onClose });
    await submitPrompt('q');
    expect(await screen.findByText('Done.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <AgentModal isOpen={false} onClose={onClose} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <AgentModal isOpen onClose={onClose} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.queryByText('Done.')).not.toBeInTheDocument();
  });

  it('disables submit on an empty prompt', () => {
    renderModal({ isOpen: true, onClose: vi.fn() });
    expect(screen.getByRole('button', { name: /ask agent/i })).toBeDisabled();
  });
});
