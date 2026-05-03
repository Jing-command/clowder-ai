import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiFetch = vi.fn();
vi.mock('@/utils/api-client', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...rest }, children),
}));

const mockStoreState = { currentThreadId: 'default' };
vi.mock('@/stores/chatStore', () => ({
  useChatStore: (selector: (s: typeof mockStoreState) => unknown) => selector(mockStoreState),
}));

import { StandupBoard } from '@/components/standup/StandupBoard';

describe('StandupBoard', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { React?: typeof React }).React = React;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockApiFetch.mockReset();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('loads standup data and renders doing/blocked/recent activity', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        generatedAt: 1710000000000,
        cats: [
          {
            id: 'codex',
            displayName: '缅因猫',
            nickname: '砚砚',
            roleDescription: 'review',
            color: { primary: '#4B5563', secondary: '#E5E7EB' },
            doing: [
              {
                id: 't1',
                kind: 'work',
                subjectKey: null,
                threadId: 'thread_a',
                title: 'Doing task',
                ownerCatId: 'codex',
                status: 'doing',
                why: '持续推进',
                createdBy: 'user',
                createdAt: Date.now() - 20_000,
                updatedAt: Date.now() - 10_000,
              },
            ],
            blocked: [
              {
                id: 't2',
                kind: 'work',
                subjectKey: null,
                threadId: 'thread_b',
                title: 'Blocked task',
                ownerCatId: 'codex',
                status: 'blocked',
                why: '等待外部条件',
                createdBy: 'user',
                createdAt: Date.now() - 50_000,
                updatedAt: Date.now() - 40_000,
              },
            ],
            activeThreadCount: 2,
            recentActive: {
              threadId: 'thread_b',
              threadTitle: 'Beta',
              lastMessageAt: Date.now() - 30_000,
              messageCount: 4,
              lastResponseHealthy: false,
            },
          },
        ],
      }),
    });

    await act(async () => {
      root.render(React.createElement(StandupBoard, { initialReferrerThread: 'thread_home' }));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/standup');
    expect(container.textContent).toContain('全队猫猫 Standup');
    expect(container.textContent).toContain('Doing task');
    expect(container.textContent).toContain('Blocked task');
    expect(container.textContent).toContain('Beta');
    expect(container.textContent).toContain('响应异常');
    const recentLink = container.querySelector('a[href="/thread/thread_b?from=thread_home"]');
    expect(recentLink).toBeTruthy();
  });

  it('renders error state when standup request fails', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    });

    await act(async () => {
      root.render(React.createElement(StandupBoard));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('boom');
  });
});
