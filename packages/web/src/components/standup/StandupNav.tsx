import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';

interface StandupNavProps {
  readonly initialReferrerThread?: string | null;
}

function useReferrerThread(initialReferrerThread: string | null): string | null {
  const storeThreadId = useChatStore((s) => s.currentThreadId);
  const [fromParam, setFromParam] = useState<string | null>(initialReferrerThread);
  useEffect(() => {
    const nextFromParam = new URLSearchParams(window.location.search).get('from');
    if (nextFromParam) setFromParam(nextFromParam);
  }, [initialReferrerThread]);
  return useMemo(() => {
    if (fromParam) return fromParam;
    return storeThreadId && storeThreadId !== 'default' ? storeThreadId : null;
  }, [fromParam, storeThreadId]);
}

export function StandupNav({ initialReferrerThread = null }: StandupNavProps) {
  const referrerThread = useReferrerThread(initialReferrerThread);
  const backHref = referrerThread && referrerThread !== 'default' ? `/thread/${referrerThread}` : '/';
  const standupHref = referrerThread ? `/standup?from=${encodeURIComponent(referrerThread)}` : '/standup';

  return (
    <nav aria-label="Standup navigation" className="flex items-center gap-2">
      <a
        href={backHref}
        className="inline-flex items-center gap-1.5 rounded-lg border border-cafe bg-cafe-surface-elevated px-3 py-1.5 text-xs font-medium text-cocreator-dark transition-colors hover:bg-cocreator-light"
        data-testid="standup-back-to-chat"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        返回线程
      </a>
      <Link
        href={standupHref}
        aria-current="page"
        className="inline-flex items-center rounded-full border border-cocreator-primary bg-cocreator-light px-3 py-1 text-xs font-semibold text-cocreator-dark transition-colors"
      >
        Standup
      </Link>
    </nav>
  );
}
