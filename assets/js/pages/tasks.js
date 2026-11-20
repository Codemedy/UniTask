/* UniTask — pages/tasks.js
 * Task manager: add, edit, delete, complete, prioritise, filter, search, sort.
 * Also exports UT.openTaskEditor() which the Dashboard reuses.
 */
(function (UT) {
  'use strict';

  const { U, DB, UI } = UT;
  const esc = U.esc;
  const PRIO_RANK = { high: 0, medium: 1, low: 2 };

  const state = { view: 'open', q: '', course: '', priority: '', sort: 'due' };

  /* ---------------- editor (modal) ---------------- */
  function openTaskEditor(task, defaults = {}) {
    const isNew = !task;
    const t = task || Object.assign({ priority: 'medium', status: 'todo', type: 'assignment', dueDate: U.isoPlusDays(3) }, defaults);
    let subs = isNew ? [] : DB.all('subtasks', { where: (s) => s.taskId === t.id, sort: (a, b) => a.position - b.position })
      .map((s) => ({ id: s.id, title: s.title, done: s.done }));
    const linkedNotes = isNew ? [] : DB.all('notes', { where: (n) => n.taskId === t.id });

    const body = `
      ${UI.F.text('title', 'Title', t.title, 'placeholder="e.g. Lab 6: JavaScript events" maxlength="120" required')}
      <div class="grid-2">
        ${UI.F.select('courseId', 'Course', UI.F.courseOptions(), t.courseId)}
        ${UI.F.select('type', 'Type', ['assignment', 'exam', 'project', 'reading', 'other'], t.type)}
      </div>
      <div class="grid-3">
        ${UI.F.select('priority', 'Priority', [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']], t.priority)}
        ${UI.F.select('status', 'Status', [['todo', 'To do'], ['in_progress', 'In progress'], ['done', 'Done']], t.status)}
        ${UI.F.input('number', 'estimatedHours', 'Estimate (h)', t.estimatedHours, 'min="0" max="500" step="0.5" placeholder="—"')}
      </div>
      <div class="grid-2">
        ${UI.F.input('date', 'dueDate', 'Due date', t.dueDate)}
        ${UI.F.input('time', 'dueTime', 'Due time', t.dueTime)}
      </div>
      ${UI.F.textarea('description', 'Description', t.description, 'rows="3" placeholder="Requirements, links, grading criteria…"')}
      <div class="field">
        <span>Subtasks <small class="muted" id="sub-count"></small></span>
        <ul class="sub-edit" id="sub-list"></ul>
        <div class="sub-add">
          <input type="text" id="sub-new" data-ignore placeholder="Add a step and press Enter" maxlength="120">
          <button type="button" class="btn btn-ghost btn-sm" id="sub-add-btn">${UI.icon('plus')}Add</button>
        </div>
      </div>
      ${linkedNotes.length ? `<div class="field"><span>Linked notes</span><div class="linked">${linkedNotes.map((n) =>
        `<a href="#/notes" class="chip" data-note="${n.id}">${UI.icon('note')}${esc(n.title)}</a>`).join('')}</div></div>` : ''}`;

    UI.openModal({
      title: isNew ? 'New task' : 'Edit task',
      body,
      wide: true,
      submitLabel: isNew ? 'Create task' : 'Save changes',
      footerExtra: isNew ? '' : `<button type="button" class="btn btn-ghost btn-danger-text" id="task-del">${UI.icon('trash')}Delete</button>`,
      onOpen(dialog) {
        const list = dialog.querySelector('#sub-list');
        const input = dialog.querySelector('#sub-new');
        const render = () => {
          list.innerHTML = subs.map((s, i) => `
            <li>
              <label class="check"><input type="checkbox" data-ignore data-i="${i}" ${s.done ? 'checked' : ''}><span></span></label>
              <input type="text" class="sub-title" data-ignore data-i="${i}" value="${esc(s.title)}" maxlength="120" aria-label="Subtask ${i + 1}">
              <button type="button" class="icon-btn icon-btn-sm" data-rm="${i}" aria-label="Remove subtask">${UI.icon('x')}</button>
            </li>`).join('');
          dialog.querySelector('#sub-count').textContent = subs.length ? `${subs.filter((s) => s.done).length}/${subs.length} done` : '';
        };
        const add = () => {
          const v = input.value.trim();
          if (!v) return;
          subs.push({ title: v, done: false });
          input.value = '';
          render();
        };
        list.addEventListener('change', (e) => { if (e.target.type === 'checkbox') { subs[e.target.dataset.i].done = e.target.checked; render(); } });
        list.addEventListener('input', (e) => { if (e.target.classList.contains('sub-title')) subs[e.target.dataset.i].title = e.target.value; });
        list.addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { subs.splice(+b.dataset.rm, 1); render(); } });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
        dialog.querySelector('#sub-add-btn').addEventListener('click', add);
        dialog.querySelectorAll('[data-note]').forEach((a) => a.addEventListener('click', () => { UI.closeModal(); }));
        const del = dialog.querySelector('#task-del');
        if (del) del.addEventListener('click', () => { UI.closeModal(); UT.actions.remove('tasks', t.id, t.title); });
        render();
      },
      onSubmit(values) {
        const pending = document.querySelector('#sub-new');
        if (pending && pending.value.trim()) subs.push({ title: pending.value.trim(), done: false });
        const saved = isNew ? DB.insert('tasks', values) : DB.update('tasks', t.id, values);
        syncSubtasks(saved.id, subs.filter((s) => s.title.trim()));
        UI.toast(isNew ? 'Task created' : 'Task saved', 'success');
      }
    });
  }

  /** Diff the edited subtask list against the table: insert / update / delete. */
  function syncSubtasks(taskId, list) {
    const existing = DB.all('subtasks', { where: (s) => s.taskId === taskId });
    const keep = new Set(list.filter((s) => s.id).map((s) => s.id));
    existing.filter((s) => !keep.has(s.id)).forEach((s) => DB.remove('subtasks', s.id));
    list.forEach((s, position) => {
      if (s.id) DB.update('subtasks', s.id, { title: s.title, done: s.done, position });
      else DB.insert('subtasks', { taskId, title: s.title, done: s.done, position });
    });
  }

  /* ---------------- queries ---------------- */
  function bucketOf(t) {
    if (t.status === 'done') return 'done';
    if (!t.dueDate) return 'nodate';
    const n = U.daysUntil(t.dueDate);
    if (n < 0) return 'overdue';
    if (n === 0) return 'today';
    if (n <= 7) return 'week';
    return 'later';
  }
  const BUCKETS = [
    ['overdue', 'Overdue'], ['today', 'Today'], ['week', 'Next 7 days'], ['later', 'Later'], ['nodate', 'No deadline'], ['done', 'Completed']
  ];

  function filtered() {
    const q = state.q.trim().toLowerCase();
    const courses = DB.index('courses');
    return DB.all('tasks', {
      where: (t) => {
        if (state.view === 'open' && t.status === 'done') return false;
        if (state.view === 'today' && !(t.status !== 'done' && t.dueDate && U.daysUntil(t.dueDate) <= 0)) return false;
        if (state.view === 'week' && !(t.status !== 'done' && t.dueDate && U.daysUntil(t.dueDate) <= 7)) return false;
        if (state.view === 'overdue' && bucketOf(t) !== 'overdue') return false;
        if (state.view === 'done' && t.status !== 'done') return false;
        if (state.course === '_none' ? t.courseId : (state.course && t.courseId !== state.course)) return false;
        if (state.priority && t.priority !== state.priority) return false;
        if (q) {
          const c = courses.get(t.courseId);
          const hay = `${t.title} ${t.description} ${c ? c.name + ' ' + c.code : ''} ${t.type}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      },
      sort: (a, b) => {
        if (state.sort === 'priority') return PRIO_RANK[a.priority] - PRIO_RANK[b.priority] || (a.dueDate || '9').localeCompare(b.dueDate || '9');
        if (state.sort === 'created') return b.createdAt.localeCompare(a.createdAt);
        if (state.sort === 'title') return a.title.localeCompare(b.title);
        if (a.status === 'done' && b.status === 'done') return (b.completedAt || '').localeCompare(a.completedAt || '');
        return (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || (a.dueTime || '99').localeCompare(b.dueTime || '99') || PRIO_RANK[a.priority] - PRIO_RANK[b.priority];
      }
    });
  }

  /* ---------------- rendering ---------------- */
  function taskRow(t, courses, subsByTask) {
    const c = courses.get(t.courseId);
    const subs = subsByTask.get(t.id) || [];
    const subDone = subs.filter((s) => s.done).length;
    return `
      <li class="task ${t.status === 'done' ? 'is-done' : ''}" data-id="${t.id}" style="--course:${c ? esc(c.color) : 'var(--border-strong)'}">
        <label class="check check-round" title="${t.status === 'done' ? 'Mark as not done' : 'Mark as done'}">
          <input type="checkbox" data-toggle="${t.id}" ${t.status === 'done' ? 'checked' : ''} aria-label="Complete ${esc(t.title)}"><span></span>
        </label>
        <button type="button" class="task-main" data-edit="${t.id}">
          <span class="task-title">${esc(t.title)}</span>
          <span class="task-meta">
            ${UI.courseChip(c)}
            <span class="muted">${U.capitalize(t.type)}</span>
            ${t.status === 'in_progress' ? UI.statusBadge(t.status) : ''}
            ${subs.length ? `<span class="subprog" title="Subtasks"><i style="width:${U.pct(subDone, subs.length)}%"></i></span><span class="muted tiny">${subDone}/${subs.length}</span>` : ''}
          </span>
        </button>
        <span class="task-side">
          ${UI.dueBadge(t)}
          ${UI.priorityBadge(t.priority)}
        </span>
        <button type="button" class="icon-btn icon-btn-sm task-del" data-del="${t.id}" aria-label="Delete ${esc(t.title)}">${UI.icon('trash')}</button>
      </li>`;
  }

  function renderList(el, tasks) {
    const courses = DB.index('courses');
    const subsByTask = new Map();
    DB.all('subtasks').forEach((s) => {
      if (!subsByTask.has(s.taskId)) subsByTask.set(s.taskId, []);
      subsByTask.get(s.taskId).push(s);
    });

    if (!tasks.length) {
      const any = DB.count('tasks') > 0;
      el.innerHTML = UI.empty(any ? 'No tasks match' : 'No tasks yet',
        any ? 'Try another filter or clear the search.' : 'Add your first assignment to start planning.',
        `<button class="btn btn-primary" data-new>${UI.icon('plus')}Add task</button>`);
      return;
    }
    if (state.sort === 'due') {
      el.innerHTML = BUCKETS.map(([key, label]) => {
        const group = tasks.filter((t) => bucketOf(t) === key);
        if (!group.length) return '';
        return `<section class="task-group group-${key}"><h3>${label} <span class="count">${group.length}</span></h3>
          <ul class="task-list">${group.map((t) => taskRow(t, courses, subsByTask)).join('')}</ul></section>`;
      }).join('');
    } else {
      el.innerHTML = `<ul class="task-list">${tasks.map((t) => taskRow(t, courses, subsByTask)).join('')}</ul>`;
    }
  }

  /** Wire up the shared row interactions (used by Dashboard too). */
  function bindTaskRows(root) {
    root.addEventListener('change', (e) => {
      const id = e.target.dataset && e.target.dataset.toggle;
      if (!id) return;
      const done = e.target.checked;
      DB.update('tasks', id, { status: done ? 'done' : 'todo' });
      UI.toast(done ? 'Nice! Task completed' : 'Task reopened', 'success');
    });
    root.addEventListener('click', (e) => {
      const edit = e.target.closest('[data-edit]');
      if (edit) { openTaskEditor(DB.get('tasks', edit.dataset.edit)); return; }
      const del = e.target.closest('[data-del]');
      if (del) { const t = DB.get('tasks', del.dataset.del); UT.actions.remove('tasks', t.id, t.title); return; }
      if (e.target.closest('[data-new]')) openTaskEditor(null);
    });
  }

  let els = null;
  const page = {
    title: 'Tasks',
    subtitle() {
      const open = DB.count('tasks', (t) => t.status !== 'done');
      return `${U.plural(open, 'open task')} · ${U.plural(DB.count('tasks', (t) => t.status === 'done'), 'completed task')}`;
    },
    actions: () => `<button class="btn btn-primary" id="add-task">${UI.icon('plus')}<span>New task</span></button>`,

    mount(view) {
      const counts = () => {
        const all = DB.all('tasks');
        return {
          open: all.filter((t) => t.status !== 'done').length,
          today: all.filter((t) => t.status !== 'done' && t.dueDate && U.daysUntil(t.dueDate) <= 0).length,
          week: all.filter((t) => t.status !== 'done' && t.dueDate && U.daysUntil(t.dueDate) <= 7).length,
          overdue: all.filter((t) => bucketOf(t) === 'overdue').length,
          done: all.filter((t) => t.status === 'done').length,
          all: all.length
        };
      };
      view.innerHTML = `
        <div class="toolbar">
          <div class="tabs" role="tablist" id="task-tabs"></div>
          <div class="toolbar-row">
            <label class="search">${UI.icon('search')}<input type="search" id="task-q" placeholder="Search tasks…" value="${esc(state.q)}" aria-label="Search tasks"></label>
            <select id="task-course" aria-label="Filter by course"></select>
            <select id="task-prio" aria-label="Filter by priority">
              <option value="">Any priority</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
            <select id="task-sort" aria-label="Sort">
              <option value="due">Sort: deadline</option><option value="priority">Sort: priority</option>
              <option value="created">Sort: newest</option><option value="title">Sort: A–Z</option>
            </select>
          </div>
        </div>
        <div id="task-results" class="card card-flush"></div>`;
      els = {
        tabs: view.querySelector('#task-tabs'),
        list: view.querySelector('#task-results'),
        course: view.querySelector('#task-course'),
        counts
      };
      view.querySelector('#task-prio').value = state.priority;
      view.querySelector('#task-sort').value = state.sort;

      els.tabs.addEventListener('click', (e) => {
        const b = e.target.closest('[data-view]');
        if (b) { state.view = b.dataset.view; page.update(); }
      });
      view.querySelector('#task-q').addEventListener('input', U.debounce((e) => { state.q = e.target.value; page.update(); }, 120));
      els.course.addEventListener('change', (e) => { state.course = e.target.value; page.update(); });
      view.querySelector('#task-prio').addEventListener('change', (e) => { state.priority = e.target.value; page.update(); });
      view.querySelector('#task-sort').addEventListener('change', (e) => { state.sort = e.target.value; page.update(); });
      document.getElementById('add-task').addEventListener('click', () => openTaskEditor(null, state.course && state.course !== '_none' ? { courseId: state.course } : {}));
      bindTaskRows(els.list);
      page.update();
    },

    update() {
      const n = els.counts();
      const tabs = [['open', 'Open', n.open], ['today', 'Due today', n.today], ['week', 'This week', n.week], ['overdue', 'Overdue', n.overdue], ['done', 'Completed', n.done], ['all', 'All', n.all]];
      els.tabs.innerHTML = tabs.map(([v, l, c]) =>
        `<button type="button" role="tab" data-view="${v}" aria-selected="${state.view === v}" class="tab ${state.view === v ? 'active' : ''} ${v === 'overdue' && c ? 'tab-alert' : ''}">${l}<span class="count">${c}</span></button>`).join('');
      els.course.innerHTML = [['', 'All courses']].concat(UI.F.courseOptions(false), [['_none', 'No course']])
        .map(([v, l]) => `<option value="${esc(v)}" ${v === state.course ? 'selected' : ''}>${esc(l)}</option>`).join('');
      if (state.course && state.course !== '_none' && !DB.get('courses', state.course)) state.course = '';
      renderList(els.list, filtered());
    },

    /** Called by the Courses page: open the task list filtered to one course */
    showCourse(courseId) { state.course = courseId; state.view = 'all'; }
  };

  UT.pages = UT.pages || {};
  UT.pages.tasks = page;
  UT.openTaskEditor = openTaskEditor;
  UT.taskRow = taskRow;
  UT.bindTaskRows = bindTaskRows;
})(globalThis.UT = globalThis.UT || {});
