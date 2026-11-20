/* UniTask — pages/dashboard.js
 * At-a-glance overview: key numbers, upcoming deadlines, today's classes,
 * pinned notes, overall progress and recent activity.
 */
(function (UT) {
  'use strict';

  const { U, DB, UI } = UT;
  const esc = U.esc;

  function greeting() {
    const h = new Date().getHours();
    return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }

  /** Classes for today; if none (e.g. weekend) the next day that has classes. */
  function nextClassDay() {
    const classes = DB.all('classes');
    for (let i = 0; i < 7; i++) {
      const date = U.addDays(U.today(), i);
      const wd = U.isoWeekday(date);
      const list = classes.filter((c) => c.day === wd).sort((a, b) => a.startTime.localeCompare(b.startTime));
      if (list.length) return { date, offset: i, list };
    }
    return null;
  }

  function classesCard(courses) {
    const next = nextClassDay();
    if (!next) return `<div class="card"><h2 class="card-title">${UI.icon('calendar')}Classes</h2>${UI.empty('No classes yet', 'Add your timetable on the Schedule page.', '<a class="btn btn-ghost" href="#/schedule">Open schedule</a>')}</div>`;
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const when = next.offset === 0 ? 'Today' : next.offset === 1 ? 'Tomorrow' : U.DAY_NAMES[U.isoWeekday(next.date) - 1];
    return `
      <div class="card">
        <h2 class="card-title">${UI.icon('calendar')}Classes · ${when}<a class="card-link" href="#/schedule">Week view</a></h2>
        <ol class="timeline">
          ${next.list.map((cl) => {
            const c = courses.get(cl.courseId);
            const live = next.offset === 0 && U.timeToMin(cl.startTime) <= nowMin && nowMin < U.timeToMin(cl.endTime);
            const past = next.offset === 0 && U.timeToMin(cl.endTime) <= nowMin;
            return `<li class="${live ? 'live' : ''} ${past ? 'past' : ''}" style="--course:${esc(c ? c.color : '#888')}">
              <span class="tl-time">${cl.startTime}<small>${cl.endTime}</small></span>
              <span class="tl-body"><b>${esc(c ? c.name : 'Class')}</b>
                <small class="muted">${U.capitalize(cl.kind)}${cl.location ? ' · ' + esc(cl.location) : ''}${live ? ' · <em class="now">now</em>' : ''}</small></span>
            </li>`;
          }).join('')}
        </ol>
      </div>`;
  }

  function progressCard() {
    const all = DB.all('tasks');
    const done = all.filter((t) => t.status === 'done').length;
    const p = U.pct(done, all.length);
    const r = 34;
    const C = 2 * Math.PI * r;
    return `
      <div class="card progress-mini">
        <h2 class="card-title">${UI.icon('chart')}Progress<a class="card-link" href="#/progress">Details</a></h2>
        <div class="ring-row">
          <svg class="ring" viewBox="0 0 84 84" role="img" aria-label="${p}% of tasks completed">
            <circle cx="42" cy="42" r="${r}" class="ring-track"/>
            <circle cx="42" cy="42" r="${r}" class="ring-value" stroke-dasharray="${(C * p) / 100} ${C}" transform="rotate(-90 42 42)"/>
            <text x="42" y="47" text-anchor="middle">${p}%</text>
          </svg>
          <div>
            <p><b>${done}</b> of <b>${all.length}</b> tasks completed</p>
            <p class="muted small">${U.plural(DB.count('tasks', (t) => t.status === 'done' && t.completedAt && (Date.now() - new Date(t.completedAt)) < 7 * 864e5), 'task')} finished in the last 7 days</p>
          </div>
        </div>
      </div>`;
  }

  function notesCard(courses) {
    const pinned = DB.all('notes', { where: (n) => n.pinned, sort: (a, b) => b.updatedAt.localeCompare(a.updatedAt) }).slice(0, 3);
    return `
      <div class="card">
        <h2 class="card-title">${UI.icon('star')}Pinned notes<a class="card-link" href="#/notes">All notes</a></h2>
        ${pinned.length ? `<ul class="mini-notes">${pinned.map((n) => {
          const c = courses.get(n.courseId);
          return `<li><button type="button" data-note="${n.id}" style="--course:${esc(c ? c.color : 'var(--border-strong)')}">
            <b>${esc(n.title)}</b><small class="muted">${esc(U.excerpt(n.content, 90))}</small></button></li>`;
        }).join('')}</ul>` : '<p class="muted small">Pin important notes to see them here.</p>'}
      </div>`;
  }

  function activityCard() {
    const items = DB.all('activity', { sort: (a, b) => b.createdAt.localeCompare(a.createdAt) }).slice(0, 6);
    const verb = { created: 'Added', updated: 'Edited', completed: 'Completed', reopened: 'Reopened', deleted: 'Deleted' };
    const kind = { tasks: 'task', notes: 'note', classes: 'class', courses: 'course', subtasks: 'subtask' };
    return `
      <div class="card">
        <h2 class="card-title">${UI.icon('activity')}Recent activity</h2>
        ${items.length ? `<ul class="activity">${items.map((a) => `
          <li class="act-${a.action}"><i></i><span>${verb[a.action]} ${kind[a.entity]} <b>${esc(a.label)}</b></span><small class="muted">${U.timeAgo(a.createdAt)}</small></li>`).join('')}</ul>`
          : '<p class="muted small">Your changes will appear here.</p>'}
      </div>`;
  }

  let root = null;
  const page = {
    title: 'Dashboard',
    subtitle: () => U.formatDate(U.todayISO(), { weekday: true, year: true }),
    actions: () => `<button class="btn btn-primary" id="dash-add">${UI.icon('plus')}<span>New task</span></button>`,

    mount(view) {
      root = view;
      document.getElementById('dash-add').addEventListener('click', () => UT.openTaskEditor(null));
      UT.bindTaskRows(view);
      view.addEventListener('click', (e) => {
        const n = e.target.closest('[data-note]');
        if (n) UT.openNoteEditor(DB.get('notes', n.dataset.note));
      });
      page.update();
    },

    update() {
      const s = DB.settings();
      const tasks = DB.all('tasks');
      const open = tasks.filter((t) => t.status !== 'done');
      const overdue = open.filter((t) => t.dueDate && U.daysUntil(t.dueDate) < 0);
      const horizon = s.upcomingDays || 7;
      const week = open.filter((t) => t.dueDate && U.daysUntil(t.dueDate) >= 0 && U.daysUntil(t.dueDate) <= horizon);
      const done = tasks.length - open.length;
      const courses = DB.index('courses');
      const subsByTask = new Map();
      DB.all('subtasks').forEach((x) => { if (!subsByTask.has(x.taskId)) subsByTask.set(x.taskId, []); subsByTask.get(x.taskId).push(x); });

      const upcoming = overdue.concat(week).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.dueTime || '99').localeCompare(b.dueTime || '99'));
      const next = week[0] ? week.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] : null;

      root.innerHTML = `
        <section class="hero">
          <div>
            <h2>${greeting()}, ${esc(s.userName || 'Student')} 👋</h2>
            <p class="muted">${open.length ? `You have <b>${U.plural(week.length, 'deadline')}</b> in the next ${horizon} days${overdue.length ? ` and <b class="text-critical">${overdue.length} overdue</b>` : ''}.` : 'All caught up — no open tasks.'}
            ${next ? ` Next up: <b>${esc(next.title)}</b> (${esc(U.relativeDue(next.dueDate).toLowerCase())}).` : ''}</p>
          </div>
        </section>

        <section class="stats">
          <a class="stat" href="#/tasks"><span class="stat-label">${UI.icon('tasks')}Open tasks</span><b class="stat-value">${open.length}</b><span class="muted small">${U.plural(open.filter((t) => t.priority === 'high').length, 'high-priority task')}</span></a>
          <a class="stat" href="#/tasks"><span class="stat-label">${UI.icon('clock')}Due in ${horizon} days</span><b class="stat-value">${week.length}</b><span class="muted small">${U.plural(week.filter((t) => U.daysUntil(t.dueDate) <= 1).length, 'task')} due by tomorrow</span></a>
          <a class="stat ${overdue.length ? 'stat-critical' : ''}" href="#/tasks"><span class="stat-label">${UI.icon('alert')}Overdue</span><b class="stat-value">${overdue.length}</b><span class="muted small">${overdue.length ? 'Needs attention' : 'Nothing overdue'}</span></a>
          <a class="stat" href="#/progress"><span class="stat-label">${UI.icon('check')}Completed</span><b class="stat-value">${done}</b><span class="muted small">${U.pct(done, tasks.length)}% of all tasks</span></a>
        </section>

        <div class="dash-grid">
          <div class="card card-flush">
            <h2 class="card-title pad">${UI.icon('clock')}Upcoming deadlines<a class="card-link" href="#/tasks">All tasks</a></h2>
            ${upcoming.length ? `<ul class="task-list">${upcoming.map((t) => UT.taskRow(t, courses, subsByTask)).join('')}</ul>`
              : UI.empty('No upcoming deadlines', `Nothing due in the next ${horizon} days. Enjoy the free time!`, '<button class="btn btn-ghost" data-new>Add a task</button>')}
          </div>
          <div class="stack">
            ${classesCard(courses)}
            ${progressCard()}
            ${notesCard(courses)}
            ${activityCard()}
          </div>
        </div>`;
    }
  };

  UT.pages = UT.pages || {};
  UT.pages.dashboard = page;
})(globalThis.UT = globalThis.UT || {});
