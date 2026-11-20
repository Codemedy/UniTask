/* Unit tests for the data layer (schema validation, foreign keys, cascades,
 * import/export). Run with:  npm test
 * The browser scripts are loaded into Node with an in-memory localStorage. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* objects created inside the vm context have other prototypes: compare as plain JSON */
const plain = (x) => JSON.parse(JSON.stringify(x));

function loadApp() {
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    key: (i) => [...store.keys()][i],
    get length() { return store.size; }
  };
  // Object.keys(localStorage) is used to list keys, so mirror entries as own props
  const ls = new Proxy(localStorage, {
    ownKeys: () => [...store.keys()],
    getOwnPropertyDescriptor: (t, k) => (store.has(k) ? { enumerable: true, configurable: true, value: store.get(k) } : Reflect.getOwnPropertyDescriptor(t, k))
  });
  const ctx = { console, localStorage: ls, Date, Math, JSON };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['utils.js', 'schema.js', 'db.js', 'seed.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', f), 'utf8'), ctx, { filename: f });
  }
  return { UT: ctx.UT, store };
}

test('first run seeds demo data that passes the integrity check', () => {
  const { UT } = loadApp();
  const { firstRun } = UT.DB.init();
  assert.equal(firstRun, true);
  assert.equal(UT.DB.count('courses'), 5);
  assert.ok(UT.DB.count('tasks') >= 20);
  assert.ok(UT.DB.count('classes') >= 10);
  assert.deepEqual(plain(UT.DB.integrityCheck()), []);
});

test('data persists in localStorage between sessions', () => {
  const { UT, store } = loadApp();
  UT.DB.init({ seed: false });
  UT.DB.insert('courses', { name: 'Physics', color: '#2a78d6' });
  assert.ok(store.get('unitask.v1.courses').includes('Physics'));
  const again = UT.DB.init();
  assert.equal(again.firstRun, false);
  assert.equal(UT.DB.all('courses')[0].name, 'Physics');
});

test('validation: required fields, enums, formats and CHECK constraints', () => {
  const { UT } = loadApp();
  const DB = UT.DB;
  DB.init({ seed: false });
  assert.throws(() => DB.insert('tasks', { title: '   ' }), (e) => e.name === 'ValidationError' && Boolean(e.errors.title));
  assert.throws(() => DB.insert('tasks', { title: 'x', priority: 'urgent' }), /priority/i);
  assert.throws(() => DB.insert('tasks', { title: 'x', dueDate: '20/11/2026' }), /date/i);
  const c = DB.insert('courses', { name: 'Math', color: '#1baf7a' });
  assert.throws(() => DB.insert('classes', { courseId: c.id, day: 1, startTime: '10:00', endTime: '09:00' }), /after start/);
  const t = DB.insert('tasks', { title: 'Essay', tags: 'ignored-unknown-field' });
  assert.equal(t.priority, 'medium');
  assert.equal(t.status, 'todo');
  assert.equal('tags' in t, false, 'unknown columns are dropped');
});

test('foreign keys must point to existing rows', () => {
  const { UT } = loadApp();
  UT.DB.init({ seed: false });
  assert.throws(() => UT.DB.insert('tasks', { title: 'Lab', courseId: 'crs_missing' }), /foreign key/);
  assert.throws(() => UT.DB.insert('subtasks', { title: 'step' }), /required/i);
});

test('deleting a course: classes CASCADE, tasks and notes SET NULL, subtasks survive', () => {
  const { UT } = loadApp();
  const DB = UT.DB;
  DB.init({ seed: false });
  const c = DB.insert('courses', { name: 'DB Systems', color: '#eb6834' });
  DB.insert('classes', { courseId: c.id, day: 2, startTime: '09:00', endTime: '10:30' });
  const t = DB.insert('tasks', { title: 'ERD', courseId: c.id });
  DB.insert('subtasks', { taskId: t.id, title: 'entities' });
  const n = DB.insert('notes', { title: 'JOINs', courseId: c.id, taskId: t.id });

  assert.deepEqual(plain(DB.previewDelete('courses', c.id)), { cascade: { classes: 1 }, unlink: { tasks: 1, notes: 1 } });
  DB.remove('courses', c.id);
  assert.equal(DB.count('classes'), 0);
  assert.equal(DB.get('tasks', t.id).courseId, null);
  assert.equal(DB.get('notes', n.id).courseId, null);
  assert.equal(DB.get('notes', n.id).taskId, t.id);
  assert.equal(DB.count('subtasks'), 1);
  assert.deepEqual(plain(DB.integrityCheck()), []);
});

test('deleting a task cascades to subtasks and unlinks notes', () => {
  const { UT } = loadApp();
  const DB = UT.DB;
  DB.init({ seed: false });
  const t = DB.insert('tasks', { title: 'Project' });
  DB.insert('subtasks', { taskId: t.id, title: 'a' });
  DB.insert('subtasks', { taskId: t.id, title: 'b' });
  const n = DB.insert('notes', { title: 'Idea', taskId: t.id });
  DB.remove('tasks', t.id);
  assert.equal(DB.count('subtasks'), 0);
  assert.equal(DB.get('notes', n.id).taskId, null);
});

test('completing and reopening a task maintains completedAt and the activity log', () => {
  const { UT } = loadApp();
  const DB = UT.DB;
  DB.init({ seed: false });
  const t = DB.insert('tasks', { title: 'Quiz' });
  assert.equal(t.completedAt, null);
  const done = DB.update('tasks', t.id, { status: 'done' });
  assert.ok(done.completedAt);
  const reopened = DB.update('tasks', t.id, { status: 'todo' });
  assert.equal(reopened.completedAt, null);
  const actions = DB.all('activity').map((a) => a.action);
  assert.deepEqual(plain(actions), ['reopened', 'completed', 'created']);
});

test('export → import round-trip keeps ids and relationships; bad import changes nothing', () => {
  const a = loadApp();
  a.UT.DB.init();
  const backup = JSON.parse(JSON.stringify(a.UT.DB.exportData()));

  const b = loadApp();
  b.UT.DB.init({ seed: false });
  b.UT.DB.importData(backup);
  for (const t of b.UT.DB.TABLE_ORDER) assert.equal(b.UT.DB.count(t), a.UT.DB.count(t), t);
  assert.deepEqual(plain(b.UT.DB.integrityCheck()), []);

  const before = b.UT.DB.count('tasks');
  const broken = JSON.parse(JSON.stringify(backup));
  broken.tables.tasks.push({ id: 'tsk_bad', title: 'orphan', courseId: 'crs_nope' });
  assert.throws(() => b.UT.DB.importData(broken), /foreign key/);
  assert.equal(b.UT.DB.count('tasks'), before, 'import is all-or-nothing');
  assert.throws(() => b.UT.DB.importData({ hello: 1 }), /not a UniTask backup/);
});

test('HTML escaping prevents script injection in rendered text', () => {
  const { UT } = loadApp();
  assert.equal(UT.U.esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
});
