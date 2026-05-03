import type { CatId, TaskItem } from '@cat-cafe/shared';
import type { FastifyPluginAsync } from 'fastify';
import { resolveUserId } from '../utils/request-identity.js';

interface StandupThreadSummary {
  id: string;
  title?: string | null;
  lastActiveAt: number;
}

interface StandupParticipantActivity {
  catId: CatId;
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
  recentActive:
    | {
        threadId: string;
        threadTitle?: string | null;
        lastMessageAt: number;
        messageCount: number;
        lastResponseHealthy?: boolean;
      }
    | null;
}

export interface StandupRoutesOptions {
  threadStore: {
    list(userId: string): Array<StandupThreadSummary> | Promise<Array<StandupThreadSummary>>;
    listByProject?(
      userId: string,
      projectPath: string,
    ): Array<StandupThreadSummary> | Promise<Array<StandupThreadSummary>>;
    getParticipantsWithActivity(threadId: string): StandupParticipantActivity[] | Promise<StandupParticipantActivity[]>;
  };
  taskStore: {
    listByThread(threadId: string): TaskItem[] | Promise<TaskItem[]>;
  };
  projectPath?: string;
  getAllCats: () => Array<{
    id: string;
    displayName: string;
    nickname?: string;
    avatar?: string;
    color?: { primary: string; secondary: string };
    roleDescription?: string;
  }>;
}

interface StandupCatProfile {
  id: string;
  displayName: string;
  nickname?: string;
  avatar?: string;
  color?: { primary: string; secondary: string };
  roleDescription?: string;
}

function createCatSummary(cat: StandupCatProfile): StandupCatSummary {
  return {
    id: cat.id,
    displayName: cat.displayName,
    nickname: cat.nickname,
    avatar: cat.avatar,
    color: cat.color,
    roleDescription: cat.roleDescription,
    doing: [],
    blocked: [],
    activeThreadCount: 0,
    recentActive: null,
  };
}

function byTaskRecency(a: TaskItem, b: TaskItem): number {
  return (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt);
}

export const standupRoutes: FastifyPluginAsync<StandupRoutesOptions> = async (app, opts) => {
  const { threadStore, taskStore, getAllCats, projectPath } = opts;

  app.get('/api/standup', async (request, reply) => {
    const userId = resolveUserId(request, { defaultUserId: 'default-user' });
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }

    const threads =
      projectPath && typeof threadStore.listByProject === 'function'
        ? await Promise.resolve(threadStore.listByProject(userId, projectPath))
        : await Promise.resolve(threadStore.list(userId));
    const cats = getAllCats();
    const catProfileById = new Map<string, StandupCatProfile>(cats.map((cat) => [cat.id, cat]));
    const summaryByCat = new Map<string, StandupCatSummary>(cats.map((cat) => [cat.id, createCatSummary(cat)]));

    const ensureSummary = (catId: string): StandupCatSummary => {
      const existing = summaryByCat.get(catId);
      if (existing) return existing;
      const created = createCatSummary(
        catProfileById.get(catId) ?? {
          id: catId,
          displayName: catId,
        },
      );
      summaryByCat.set(catId, created);
      return created;
    };

    for (const thread of threads) {
      const [tasks, participantActivity] = await Promise.all([
        Promise.resolve(taskStore.listByThread(thread.id)),
        Promise.resolve(threadStore.getParticipantsWithActivity(thread.id)),
      ]);

      for (const task of tasks) {
        if (!task.ownerCatId) continue;
        const summary = ensureSummary(task.ownerCatId);
        if (task.status === 'doing') summary.doing.push(task);
        if (task.status === 'blocked') summary.blocked.push(task);
      }

      for (const activity of participantActivity) {
        if (activity.lastMessageAt <= 0) continue;
        const summary = ensureSummary(activity.catId);
        summary.activeThreadCount += 1;
        if (!summary.recentActive || activity.lastMessageAt > summary.recentActive.lastMessageAt) {
          summary.recentActive = {
            threadId: thread.id,
            threadTitle: thread.title,
            lastMessageAt: activity.lastMessageAt,
            messageCount: activity.messageCount,
            lastResponseHealthy: activity.lastResponseHealthy,
          };
        }
      }
    }

    const teams = [...summaryByCat.values()]
      .map((summary) => ({
        ...summary,
        doing: [...summary.doing].sort(byTaskRecency),
        blocked: [...summary.blocked].sort(byTaskRecency),
      }))
      .sort((a, b) => {
        const scoreA = a.doing.length + a.blocked.length;
        const scoreB = b.doing.length + b.blocked.length;
        if (scoreA !== scoreB) return scoreB - scoreA;
        const recentA = a.recentActive?.lastMessageAt ?? 0;
        const recentB = b.recentActive?.lastMessageAt ?? 0;
        if (recentA !== recentB) return recentB - recentA;
        return a.displayName.localeCompare(b.displayName, 'zh-CN');
      });

    return {
      generatedAt: Date.now(),
      cats: teams,
    };
  });
};
