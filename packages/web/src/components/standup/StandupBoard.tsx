'use client';

import type { TaskItem } from '@cat-cafe/shared';
import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/utils/api-client';
import { StandupNav } from './StandupNav';

interface StandupRecentActive {
  threadId: string;
  threadTitle?: string | null;
  lastMessageAt: number;
  messageCount: number;
  lastResponseHealthy?: boolean;
}

interface StandupCatSummary {
  id: string;
  displayName: string;
  nickname?: string;
  avatar?: string;
  color?: { primary: string; secondary: string };
  roleDescription?: string;
  doing: TaskItem[];
  blocked: TaskItem[];
  activeThreadCount: number;
  recentActive: StandupRecentActive | null;
}

interface StandupResponse {
  generatedAt: number;
  cats: StandupCatSummary[];
}

function formatRelativeTime(timestamp: number): string {
  const delta = Math.max(0, Date.now() - timestamp);
  if (delta < 60_000) return `${Math.max(1, Math.floor(delta / 1_000))} 秒前`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`;
  return `${Math.floor(delta / 86_400_000)} 天前`;
}

function formatGeneratedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildThreadHref(threadId: string, referrerThread: string | null): string {
  const fromParam = referrerThread ? `?from=${encodeURIComponent(referrerThread)}` : '';
  return `/thread/${threadId}${fromParam}`;
}

function taskRecency(task: TaskItem): number {
  return task.updatedAt ?? task.createdAt;
}

function sortByRecency(tasks: readonly TaskItem[]): TaskItem[] {
  return [...tasks].sort((a, b) => taskRecency(b) - taskRecency(a));
}

function parseError(status: number, message?: string): string {
  if (message) return message;
  return status >= 500 ? 'Standup 面板加载失败' : `请求失败 (${status})`;
}

function statusTone(healthy: boolean | undefined): string {
  return healthy === false ? 'text-conn-red-text' : 'text-conn-green-text';
}

function TaskStrip({
  label,
  toneClass,
  tasks,
}: {
  label: string;
  toneClass: string;
  tasks: readonly TaskItem[];
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cafe-muted">{label}</h3>
        <span className={`text-xs font-semibold ${toneClass}`}>{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-cafe-subtle bg-cafe-surface px-3 py-2 text-xs text-cafe-muted">
          暂无
        </p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <article key={task.id} className="rounded-xl border border-cafe bg-cafe-surface-elevated px-3 py-2">
              <p className="text-sm font-medium text-cafe-black">{task.title}</p>
              {task.why ? <p className="mt-1 text-xs leading-5 text-cafe-secondary">{task.why}</p> : null}
              <div className="mt-2 flex items-center justify-between text-[11px] text-cafe-muted">
                <span>{task.threadId}</span>
                <span>{formatRelativeTime(taskRecency(task))}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CatCard({ cat, referrerThread }: { cat: StandupCatSummary; referrerThread: string | null }) {
  const recentHref = cat.recentActive ? buildThreadHref(cat.recentActive.threadId, referrerThread) : null;
  const accent = cat.color?.primary ?? '#7A6651';
  return (
    <article
      className="overflow-hidden rounded-[28px] border border-cafe bg-[linear-gradient(180deg,var(--cafe-surface)_0%,var(--cafe-surface-elevated)_100%)] shadow-[0_18px_50px_rgba(94,64,31,0.08)]"
      data-testid={`standup-cat-${cat.id}`}
    >
      <div className="border-b border-cafe-subtle px-5 py-4" style={{ backgroundColor: `${accent}14` }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-cafe-black">
              {cat.displayName}
              {cat.nickname ? <span className="ml-2 text-sm font-medium text-cafe-muted">{cat.nickname}</span> : null}
            </p>
            {cat.roleDescription ? <p className="mt-1 text-xs text-cafe-secondary">{cat.roleDescription}</p> : null}
          </div>
          <div
            className="rounded-full border px-3 py-1 text-[11px] font-semibold"
            style={{ borderColor: `${accent}55`, color: accent, backgroundColor: `${accent}12` }}
          >
            {cat.activeThreadCount} 个活跃线程
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-cafe-subtle bg-cafe-surface px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cafe-muted">最近活跃</p>
              {cat.recentActive ? (
                <>
                  <p className="mt-1 text-sm font-medium text-cafe-black">{cat.recentActive.threadTitle || cat.recentActive.threadId}</p>
                  <p className="mt-1 text-xs text-cafe-secondary">
                    {formatRelativeTime(cat.recentActive.lastMessageAt)} · {cat.recentActive.messageCount} 条发言
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-cafe-muted">暂无活跃记录</p>
              )}
            </div>
            {cat.recentActive ? (
              <div className="text-right">
                <p className={`text-xs font-semibold ${statusTone(cat.recentActive.lastResponseHealthy)}`}>
                  {cat.recentActive.lastResponseHealthy === false ? '响应异常' : '响应正常'}
                </p>
                <a
                  href={recentHref ?? '#'}
                  className="mt-2 inline-flex text-xs font-medium text-cafe-accent underline-offset-2 hover:text-cocreator-dark hover:underline"
                >
                  打开 thread
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
        <TaskStrip label="Doing" toneClass="text-conn-green-text" tasks={sortByRecency(cat.doing)} />
        <TaskStrip label="Blocked" toneClass="text-conn-red-text" tasks={sortByRecency(cat.blocked)} />
      </div>
    </article>
  );
}

export function StandupBoard({ initialReferrerThread = null }: { initialReferrerThread?: string | null }) {
  const [data, setData] = useState<StandupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromParam, setFromParam] = useState<string | null>(initialReferrerThread);

  useEffect(() => {
    const nextFromParam = new URLSearchParams(window.location.search).get('from');
    if (nextFromParam) setFromParam(nextFromParam);
  }, [initialReferrerThread]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch('/api/standup');
        if (!response.ok) {
          let message: string | undefined;
          try {
            const body = (await response.json()) as { error?: string };
            message = body.error;
          } catch {
            message = undefined;
          }
          throw new Error(parseError(response.status, message));
        }
        const body = (await response.json()) as StandupResponse;
        if (!cancelled) setData(body);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Standup 面板加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cats = useMemo(() => data?.cats ?? [], [data]);

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top_left,#FFF7E8_0%,#F7F0E5_42%,#EFE5D8_100%)]" data-testid="standup-board">
      <header className="border-b border-cafe bg-cafe-surface/90 px-4 py-4 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3">
          <StandupNav initialReferrerThread={fromParam} />
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-cafe-black">全队猫猫 Standup</h1>
              <p className="text-sm text-cafe-secondary">聚焦 doing、blocked 和最近活跃，适合训练营 Q12 的最小协作视图。</p>
            </div>
            <div className="rounded-2xl border border-cafe bg-cafe-surface-elevated px-4 py-2 text-xs text-cafe-secondary">
              {data ? `更新于 ${formatGeneratedAt(data.generatedAt)}` : '等待数据'}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 md:px-6">
        {loading ? (
          <div className="rounded-[28px] border border-dashed border-conn-slate-ring bg-conn-slate-bg px-6 py-10 text-center text-sm text-conn-slate-text">
            Standup 面板加载中...
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-[28px] border border-conn-red-ring bg-conn-red-bg px-6 py-10 text-center text-sm text-conn-red-text">
            {error}
          </div>
        ) : null}

        {!loading && !error && cats.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-conn-amber-ring bg-conn-amber-bg px-6 py-10 text-center text-sm text-conn-amber-text">
            暂无猫猫数据
          </div>
        ) : null}

        {!loading && !error && cats.length > 0 ? (
          <section className="grid gap-5 lg:grid-cols-2">
            {cats.map((cat) => (
              <CatCard key={cat.id} cat={cat} referrerThread={fromParam} />
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}
