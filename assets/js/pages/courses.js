/* UniTask — pages/courses.js
 * Courses are the "parent" table: tasks, classes and notes link to them.
 * This page shows those relationships (counts per course) and handles CRUD.
 */
(function (UT) {
  'use strict';

  const { U, DB, UI } = UT;
  const esc = U.esc;
  /* Fixed categorical order (validated for colour-blind separation) */
  const COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

  function nextColor() {
    const used = new Set(DB.all('courses').map((c) => c.color));
    return COLORS.find((c) => !used.has(c)) || COLORS[DB.count('courses') % COLORS.length];
  }

  /** "Algorithms & Data Structures" → "AD" */
  function initials(name) {
    const words = String(name).split(/\s+/).filter((w) => /^[\p{L}\d]/u.test(w));
    return (words.length > 1 ? words[0][0] + words[1][0] : String(name).slice(0, 2)).toUpperCase();
  }

  function openCourseEditor(course) {
    const isNew = !course;
    const c = course || { color: nextColor(), credits: 5 };
    UI.openModal({
      title: isNew ? 'New course' : 'Edit course',
      submitLabel: isNew ? 'Create course' : 'Save changes',
      body: `
        ${UI.F.text('name', 'Course name', c.name, 'placeholder="e.g. Operating Systems" maxlength="80"')}
        <div class="grid-2">
          ${UI.F.text('code', 'Code', c.code, 'placeholder="CSE 301" maxlength="20"')}
          ${UI.F.input('number', 'credits', 'Credits (ECTS)', c.credits, 'min="0" max="30" step="1"')}
        </div>
        ${UI.F.text('teacher', 'Teacher', c.teacher, 'placeholder="Dr. …" maxlength="80"')}
        <div class="field"><span>Colour</span>
          <div class="swatches" role="radiogroup" aria-label="Course colour">
            ${COLORS.concat(COLORS.includes(c.color) ? [] : [c.color]).map((col) => `
              <label class="swatch" style="--sw:${col}"><input type="radio" name="color" value="${col}" ${col === c.color ? 'checked' : ''} aria-label="${col}"><span></span></label>`).join('')}
          </div>
        </div>`,
      footerExtra: isNew ? '' : `<button type="button" class="btn btn-ghost btn-danger-text" id="crs-del">${UI.icon('trash')}Delete</button>`,
      onOpen(dialog) {
        const del = dialog.querySelector('#crs-del');
        if (del) del.addEventListener('click', () => { UI.closeModal(); UT.actions.remove('courses', c.id, c.name); });
      },
      onSubmit(values) {
        if (isNew) DB.insert('courses', values); else DB.update('courses', c.id, values);
        UI.toast(isNew ? 'Course created' : 'Course saved', 'success');
      }
    });
  }

  let root = null;
  const page = {
    title: 'Courses',
    subtitle: () => `${U.plural(DB.count('courses'), 'course')} · ${DB.all('courses').reduce((s, c) => s + (c.credits || 0), 0)} credits`,
    actions: () => `<button class="btn btn-primary" id="add-course">${UI.icon('plus')}<span>New course</span></button>`,

    mount(view) {
      root = view;
      document.getElementById('add-course').addEventListener('click', () => openCourseEditor(null));
      view.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const c = DB.get('courses', b.dataset.id);
        if (b.dataset.act === 'edit') openCourseEditor(c);
        if (b.dataset.act === 'delete') UT.actions.remove('courses', c.id, c.name);
        if (b.dataset.act === 'tasks') { UT.pages.tasks.showCourse(c.id); location.hash = '#/tasks'; }
        if (b.dataset.act === 'add-task') UT.openTaskEditor(null, { courseId: c.id });
        if (b.dataset.act === 'add-class') UT.openClassEditor(null, { courseId: c.id });
        if (b.dataset.act === 'new') openCourseEditor(null);
      });
      page.update();
    },

    update() {
      const courses = DB.all('courses', { sort: (a, b) => a.name.localeCompare(b.name) });
      if (!courses.length) {
        root.innerHTML = `<div class="card">${UI.empty('No courses yet', 'Courses connect your tasks, classes and notes.',
          `<button class="btn btn-primary" data-act="new">${UI.icon('plus')}Add course</button>`)}</div>`;
        return;
      }
      const tasks = DB.all('tasks');
      const classes = DB.all('classes');
      const notes = DB.all('notes');
      root.innerHTML = `<div class="course-grid">${courses.map((c) => {
        const ct = tasks.filter((t) => t.courseId === c.id);
        const done = ct.filter((t) => t.status === 'done').length;
        const cc = classes.filter((x) => x.courseId === c.id);
        const mins = cc.reduce((s, x) => s + U.timeToMin(x.endTime) - U.timeToMin(x.startTime), 0);
        const nextDue = ct.filter((t) => t.status !== 'done' && t.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
        return `<article class="card course" style="--course:${esc(c.color)}">
          <header>
            <span class="course-badge">${esc(initials(c.name))}</span>
            <div><h3>${esc(c.name)}</h3><p class="muted small">${esc([c.code, c.teacher].filter(Boolean).join(' · ') || '—')}</p></div>
            <button class="icon-btn icon-btn-sm" data-act="edit" data-id="${c.id}" aria-label="Edit ${esc(c.name)}">${UI.icon('edit')}</button>
          </header>
          <dl class="course-stats">
            <div><dt>Tasks</dt><dd>${ct.length - done}<small> open</small></dd></div>
            <div><dt>Classes</dt><dd>${cc.length}<small> / week</small></dd></div>
            <div><dt>In class</dt><dd>${(mins / 60).toFixed(1).replace('.0', '')}<small> h</small></dd></div>
            <div><dt>Notes</dt><dd>${notes.filter((n) => n.courseId === c.id).length}</dd></div>
          </dl>
          <div class="bar-line" title="${done} of ${ct.length} tasks completed"><span style="width:${U.pct(done, ct.length)}%"></span></div>
          <p class="small muted">${U.pct(done, ct.length)}% done · ${c.credits || 0} credits${nextDue ? ` · next: <b>${esc(U.excerpt(nextDue.title, 32))}</b> (${esc(U.relativeDue(nextDue.dueDate).toLowerCase())})` : ''}</p>
          <footer>
            <button class="btn btn-ghost btn-sm" data-act="tasks" data-id="${c.id}">${UI.icon('tasks')}Tasks</button>
            <button class="btn btn-ghost btn-sm" data-act="add-task" data-id="${c.id}">${UI.icon('plus')}Task</button>
            <button class="btn btn-ghost btn-sm" data-act="add-class" data-id="${c.id}">${UI.icon('plus')}Class</button>
            <span class="spacer"></span>
            <button class="icon-btn icon-btn-sm" data-act="delete" data-id="${c.id}" aria-label="Delete ${esc(c.name)}">${UI.icon('trash')}</button>
          </footer>
        </article>`;
      }).join('')}</div>`;
    }
  };

  UT.pages = UT.pages || {};
  UT.pages.courses = page;
  UT.openCourseEditor = openCourseEditor;
  UT.COURSE_COLORS = COLORS;
})(globalThis.UT = globalThis.UT || {});
