import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...rest }, children),
}));

const mockStoreState = { currentThreadId: 'default' };
vi.mock('@/stores/chatStore', () => ({
  useChatStore: (selector: (s: typeof mockStoreState) => unknown) => selector(mockStoreState),
}));

import { StandupNav } from '@/components/standup/StandupNav';

describe('StandupNav', () => {
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
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    mockStoreState.currentThreadId = 'default';
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '' },
      writable: true,
      configurable: true,
    });
  });

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('renders back button and active standup link', async () => {
    await act(async () => {
      root.render(React.createElement(StandupNav));
    });

    const links = Array.from(container.querySelectorAll('a'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/', '/standup']);
    expect(links.map((link) => link.textContent)).toEqual(['返回线程', 'Standup']);
    expect(links[1]?.getAttribute('aria-current')).toBe('page');
  });

  it('uses ?from= for back link and preserves it on standup link', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?from=thread_abc' },
      writable: true,
      configurable: true,
    });

    await act(async () => {
      root.render(React.createElement(StandupNav));
    });

    const links = Array.from(container.querySelectorAll('a'));
    expect(links[0]?.getAttribute('href')).toBe('/thread/thread_abc');
    expect(links[1]?.getAttribute('href')).toBe('/standup?from=thread_abc');
  });

  it('falls back to currentThreadId when there is no from param', async () => {
    mockStoreState.currentThreadId = 'thread_xyz';

    await act(async () => {
      root.render(React.createElement(StandupNav));
    });

    const backLink = container.querySelector('[data-testid="standup-back-to-chat"]') as HTMLAnchorElement | null;
    expect(backLink?.getAttribute('href')).toBe('/thread/thread_xyz');
  });
});
