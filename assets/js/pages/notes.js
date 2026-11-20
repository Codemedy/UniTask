/* UniTask — pages/notes.js
 * Study notes: create, edit, delete, pin, tag and search.
 * A note can be linked to a course and (optionally) to one task.
 */
(function (UT) {
  'use strict';

  const { U, DB, UI } = UT;
  const esc = U.esc;
  const state = { q: '', course: '', tag: '' };

  function taskOptions(currentId) {
    const courses = DB.index('courses');
    const list = DB.all('tasks', {
      where: (t) => t.status !== 'done' || t.id === currentId,
      sort: (a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9')
    }).map((t) => {
      const c = courses.get(t.courseId);
      return [t.id, `${t.title}${c ? ' — ' + c.name : ''}`];
    });
    return [['', 'Not linked to a task']].concat(list);
  }

  function openNoteEditor(note, defaults = {}) {
    const isNew = !note;
    const n = note || Object.assign({ tags: [], pinned: false }, defaults);
    UI.openModal({
      title: isNew ? 'New note' : 'Edit note',
      wide: true,
      submitLabel: isNew ? 'Create note' : 'Save changes',
      body: `
        ${UI.F.text('title', 'Title', n.title, 'placeholder="e.g. SQL JOIN types" maxlength="120"')}
        <div class="grid-2">
          ${UI.F.select('courseId', 'Course', UI.F.courseOptions(), n.courseId)}
          ${UI.F.select('taskId', 'Linked task', taskOptions(n.taskId), n.taskId)}
        </div>
        ${UI.F.textarea('content', 'Content', n.content, 'rows="10" class="note-area" placeholder="Write your notes here…"')}
        <div class="grid-2 align-end">
          ${UI.F.text('tags', 'Tags (comma separated)', (n.tags || []).join(', '), 'placeholder="exam, formulas"')}
          ${UI.F.checkbox('pinned', 'Pin to dashboard', n.pinned)}
        </div>
        ${!isNew ? `<p class="muted tiny">Created ${esc(U.formatDateTime(n.createdAt))} · Updated ${esc(U.timeAgo(n.updatedAt))}</p>` : ''}`,
      footerExtra: isNew ? '' : `<button type="button" class="btn btn-ghost btn-danger-text" id="note-del">${UI.icon('trash')}Delete</button>`,
      onOpen(dialog) {
        const del = dialog.querySelector('#note-del');
        if (del) del.addEventListener('click', () => { UI.closeModal(); UT.actions.remove('notes', n.id, n.title); });
        // when a task is chosen, adopt its course if none chosen yet
        const task = dialog.querySelector('[name=taskId]');
        const course = dialog.querySelector('[name=courseId]');
        task.addEventListener('change', () => {
          const t = DB.get('tasks', task.value);
          if (t && t.courseId && !course.value) course.value = t.courseId;
        });
      },
      onSubmit(values) {
        if (isNew) DB.insert('notes', values); else DB.update('notes', n.id, values);
        UI.toast(isNew ? 'Note created' : 'Note saved', 'success');
      }
    });
  }

  function highlight(text, q) {
    const safe = esc(text);
    if (!q) return safe;
    const rx = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').split(/\s+/).map(esc).join('|')})`, 'gi');
    return safe.replace(rx, '<mark>$1</mark>');
  }

  let els = null;
  const page = {
    title: 'Notes',
    subtitle: () => `${U.plural(DB.count('notes'), 'note')} · ${U.plural(DB.count('notes', (n) => n.pinned), 'pinned note')}`,
    actions: () => `<button class="btn btn-primary" id="add-note">${UI.icon('plus')}<span>New note</span></button>`,

    mount(view) {
      view.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-row">
            <label class="search">${UI.icon('search')}<input type="search" id="note-q" placeholder="Search titles, content and tags…" value="${esc(state.q)}" aria-label="Search notes"></label>
            <select id="note-course" aria-label="Filter by course"></select>
          </div>
          <div class="tag-row" id="tag-row"></div>
        </div>
        <div id="note-grid"></div>`;
      els = { grid: view.querySelector('#note-grid'), course: view.querySelector('#note-course'), tags: view.querySelector('#tag-row') };
      document.getElementById('add-note').addEventListener('click', () => openNoteEditor(null, state.course && state.course !== '_none' ? { courseId: state.course } : {}));
      view.querySelector('#note-q').addEventListener('input', U.debounce((e) => { state.q = e.target.value; page.update(); }, 120));
      els.course.addEventListener('change', (e) => { state.course = e.target.value; page.update(); });
      els.tags.addEventListener('click', (e) => {
        const b = e.target.closest('[data-tag]');
        if (b) { state.tag = state.tag === b.dataset.tag ? '' : b.dataset.tag; page.update(); }
      });
      view.addEventListener('click', (e) => {
        const pin = e.target.closest('[data-pin]');
        if (pin) { const n = DB.get('notes', pin.dataset.pin); DB.update('notes', n.id, { pinned: !n.pinned }); return; }
        const card = e.target.closest('[data-open]');
        if (card) openNoteEditor(DB.get('notes', card.dataset.open));
        if (e.target.closest('[data-new]')) openNoteEditor(null);
      });
      page.update();
    },

    update() {
      if (state.course && state.course !== '_none' && !DB.get('courses', state.course)) state.course = '';
      els.course.innerHTML = [['', 'All courses']].concat(UI.F.courseOptions(false), [['_none', 'No course']])
        .map(([v, l]) => `<option value="${esc(v)}" ${v === state.course ? 'selected' : ''}>${esc(l)}</option>`).join('');

      const all = DB.all('notes');
      const tagCount = new Map();
      all.forEach((n) => (n.tags || []).forEach((t) => tagCount.set(t, (tagCount.get(t) || 0) + 1)));
      if (state.tag && !tagCount.has(state.tag)) state.tag = '';
      els.tags.innerHTML = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).map(([t, c]) =>
        `<button type="button" class="tag ${state.tag === t ? 'active' : ''}" data-tag="${esc(t)}">#${esc(t)} <span>${c}</span></button>`).join('');

      const q = state.q.trim().toLowerCase();
      const courses = DB.index('courses');
      const tasks = DB.index('tasks');
      const notes = all.filter((n) => {
        if (state.course === '_none' ? n.courseId : (state.course && n.courseId !== state.course)) return false;
        if (state.tag && !(n.tags || []).includes(state.tag)) return false;
        if (q) {
          const c = courses.get(n.courseId);
          const hay = `${n.title} ${n.content} ${(n.tags || []).join(' ')} ${c ? c.name : ''}`.toLowerCase();
          return q.split(/\s+/).every((w) => hay.includes(w));
        }
        return true;
      }).sort((a, b) => (b.pinned - a.pinned) || b.updatedAt.localeCompare(a.updatedAt));

      if (!notes.length) {
        els.grid.innerHTML = `<div class="card">${UI.empty(all.length ? 'No notes match' : 'No notes yet',
          all.length ? 'Try a different search or filter.' : 'Keep lecture notes, formulas and ideas in one place.',
          `<button class="btn btn-primary" data-new>${UI.icon('plus')}New note</button>`)}</div>`;
        return;
      }
      els.grid.innerHTML = `<div class="note-grid">${notes.map((n) => {
        const c = courses.get(n.courseId);
        const t = tasks.get(n.taskId);
        return `<article class="note ${n.pinned ? 'pinned' : ''}" style="--course:${esc(c ? c.color : 'var(--border-strong)')}">
          <button type="button" class="note-open" data-open="${n.id}" aria-label="Open note ${esc(n.title)}"></button>
          <header><h3>${highlight(n.title, q)}</h3>
            <button type="button" class="icon-btn icon-btn-sm pin-btn ${n.pinned ? 'on' : ''}" data-pin="${n.id}" aria-pressed="${n.pinned}" aria-label="${n.pinned ? 'Unpin' : 'Pin'} note">${UI.icon('star')}</button>
          </header>
          <p class="note-body">${highlight(n.content.length > 260 ? n.content.slice(0, 259) + '…' : n.content, q)}</p>
          <footer>
            ${UI.courseChip(c)}
            ${t ? `<span class="chip chip-muted" title="Linked task">${UI.icon('tasks')}${esc(U.excerpt(t.title, 28))}</span>` : ''}
            ${(n.tags || []).map((tg) => `<span class="tag-sm">#${esc(tg)}</span>`).join('')}
            <span class="muted tiny note-time">${U.timeAgo(n.updatedAt)}</span>
          </footer>
        </article>`;
      }).join('')}</div>`;
    }
  };

  UT.pages = UT.pages || {};
  UT.pages.notes = page;
  UT.openNoteEditor = openNoteEditor;
})(globalThis.UT = globalThis.UT || {});
