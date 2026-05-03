import './helpers/setup-cat-registry.js';
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import Fastify from 'fastify';

describe('Standup Route', () => {
  let app;
  let threadStore;
  let taskStore;

  beforeEach(async () => {
    const [{ ThreadStore }, { TaskStore }, { standupRoutes }] = await Promise.all([
      import('../dist/domains/cats/services/stores/ports/ThreadStore.js'),
      import('../dist/domains/cats/services/stores/ports/TaskStore.js'),
      import('../dist/routes/standup.js'),
    ]);

    threadStore = new ThreadStore();
    taskStore = new TaskStore();

    app = Fastify();
    await app.register(standupRoutes, {
      threadStore,
      taskStore,
      getAllCats: () => [
        {
          id: 'codex',
          displayName: '缅因猫',
          nickname: '砚砚',
          roleDescription: 'review',
          color: { primary: '#4B5563', secondary: '#E5E7EB' },
          avatar: '/avatars/codex.png',
        },
        {
          id: 'opus',
          displayName: '布偶猫',
          nickname: '宪宪',
          roleDescription: 'build',
          color: { primary: '#8B6F47', secondary: '#F7EEDB' },
          avatar: '/avatars/opus.png',
        },
      ],
    });
    await app.ready();
  });

  test('aggregates doing and blocked tasks per cat with recent activity', async () => {
    const threadA = threadStore.create('default-user', 'Alpha');
    const threadB = threadStore.create('default-user', 'Beta');

    const doingTask = await taskStore.create({
      threadId: threadA.id,
      title: 'Doing task',
      why: '',
      createdBy: 'user',
      ownerCatId: 'codex',
    });
    const blockedTask = await taskStore.create({
      threadId: threadB.id,
      title: 'Blocked task',
      why: '',
      createdBy: 'user',
      ownerCatId: 'codex',
    });
    const opusTask = await taskStore.create({
      threadId: threadA.id,
      title: 'Opus task',
      why: '',
      createdBy: 'user',
      ownerCatId: 'opus',
    });

    await taskStore.update(doingTask.id, { status: 'doing' });
    await taskStore.update(blockedTask.id, { status: 'blocked' });
    await taskStore.update(opusTask.id, { status: 'doing' });

    threadStore.updateParticipantActivity(threadA.id, 'codex', true);
    await new Promise((resolve) => setTimeout(resolve, 2));
    threadStore.updateParticipantActivity(threadB.id, 'codex', false);
    await new Promise((resolve) => setTimeout(resolve, 2));
    threadStore.updateParticipantActivity(threadA.id, 'opus', true);

    const res = await app.inject({
      method: 'GET',
      url: '/api/standup',
      headers: { origin: 'http://localhost:3003' },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(Array.isArray(body.cats), true);

    const codex = body.cats.find((cat) => cat.id === 'codex');
    assert.ok(codex);
    assert.equal(codex.doing.length, 1);
    assert.equal(codex.blocked.length, 1);
    assert.equal(codex.activeThreadCount, 2);
    assert.equal(codex.recentActive.threadTitle, 'Beta');
    assert.equal(codex.recentActive.lastResponseHealthy, false);

    const opus = body.cats.find((cat) => cat.id === 'opus');
    assert.ok(opus);
    assert.equal(opus.doing.length, 1);
    assert.equal(opus.blocked.length, 0);
    assert.equal(opus.recentActive.threadTitle, 'Alpha');
  });

  test('includes idle cats with empty task lists and null recent activity', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/standup',
      headers: { origin: 'http://localhost:3003' },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    const codex = body.cats.find((cat) => cat.id === 'codex');
    assert.ok(codex);
    assert.deepEqual(codex.doing, []);
    assert.deepEqual(codex.blocked, []);
    assert.equal(codex.recentActive, null);
  });

  test('scopes aggregation to the configured projectPath when provided', async () => {
    await app.close();

    const [{ ThreadStore }, { TaskStore }, { standupRoutes }] = await Promise.all([
      import('../dist/domains/cats/services/stores/ports/ThreadStore.js'),
      import('../dist/domains/cats/services/stores/ports/TaskStore.js'),
      import('../dist/routes/standup.js'),
    ]);

    threadStore = new ThreadStore();
    taskStore = new TaskStore();

    app = Fastify();
    await app.register(standupRoutes, {
      threadStore,
      taskStore,
      projectPath: '/repo/a',
      getAllCats: () => [
        {
          id: 'codex',
          displayName: '缅因猫',
        },
      ],
    });
    await app.ready();

    const inProject = threadStore.create('default-user', 'In Project', '/repo/a');
    const otherProject = threadStore.create('default-user', 'Other Project', '/repo/b');

    const inProjectTask = await taskStore.create({
      threadId: inProject.id,
      title: 'Scoped task',
      why: '',
      createdBy: 'user',
      ownerCatId: 'codex',
    });
    const otherProjectTask = await taskStore.create({
      threadId: otherProject.id,
      title: 'Leaked task',
      why: '',
      createdBy: 'user',
      ownerCatId: 'codex',
    });

    await taskStore.update(inProjectTask.id, { status: 'doing' });
    await taskStore.update(otherProjectTask.id, { status: 'blocked' });

    threadStore.updateParticipantActivity(inProject.id, 'codex', true);
    threadStore.updateParticipantActivity(otherProject.id, 'codex', true);

    const res = await app.inject({
      method: 'GET',
      url: '/api/standup',
      headers: { origin: 'http://localhost:3003' },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    const codex = body.cats.find((cat) => cat.id === 'codex');
    assert.ok(codex);
    assert.equal(codex.doing.length, 1);
    assert.equal(codex.blocked.length, 0);
    assert.equal(codex.doing[0].title, 'Scoped task');
    assert.equal(codex.activeThreadCount, 1);
    assert.equal(codex.recentActive.threadTitle, 'In Project');
  });
});
