/* UniTask — ui.js
 * Reusable UI pieces: modal dialogs, confirm, toasts, form field builders,
 * badges and empty states. Pages build HTML strings with these helpers.
 */
(function (UT) {
  'use strict';

  const U = UT.U;
  const esc = U.esc;
  const $ = (sel, root = document) => root.querySelector(sel);

  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  /* ---------- toasts ---------- */
  function toast(message, type = 'info') {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `${icon(type === 'error' ? 'alert' : 'check')}<span>${esc(message)}</span>`;
    box.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3000);
  }

  /* ---------- modal ---------- */
  let lastFocus = null;
  function closeModal() {
    const root = $('#modal-root');
    root.hidden = true;
    root.innerHTML = '';
    document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /**
   * openModal({ title, body, submitLabel, onSubmit(values, form) , onOpen(dialog), wide, footerExtra })
   * onSubmit may throw a DB.ValidationError: messages are shown next to the fields.
   */
  function openModal(opts) {
    lastFocus = document.activeElement;
    const root = $('#modal-root');
    root.innerHTML = `
      <div class="modal-backdrop" data-close></div>
      <div class="modal ${opts.wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <form class="modal-form" novalidate>
          <header class="modal-head">
            <h2 id="modal-title">${esc(opts.title)}</h2>
            <button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button>
          </header>
          <div class="modal-body">${opts.body}</div>
          <p class="form-error" hidden></p>
          <footer class="modal-foot">
            ${opts.footerExtra || ''}
            <span class="spacer"></span>
            <button type="button" class="btn btn-ghost" data-close>${esc(opts.cancelLabel || 'Cancel')}</button>
            ${opts.onSubmit ? `<button type="submit" class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}">${esc(opts.submitLabel || 'Save')}</button>` : ''}
          </footer>
        </form>
      </div>`;
    root.hidden = false;
    document.body.classList.add('modal-open');
    const dialog = $('.modal', root);
    const form = $('form', root);

    root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      form.querySelectorAll('.field-error').forEach((x) => x.remove());
      form.querySelectorAll('.invalid').forEach((x) => x.classList.remove('invalid'));
      const err = $('.form-error', form);
      err.hidden = true;
      try {
        const keepOpen = opts.onSubmit(readForm(form), form);
        if (keepOpen !== true) closeModal();
      } catch (ex) {
        if (ex && ex.errors) {
          Object.entries(ex.errors).forEach(([field, msg]) => {
            const input = form.querySelector(`[name="${field}"]`);
            if (input) {
              input.classList.add('invalid');
              input.closest('.field').insertAdjacentHTML('beforeend', `<small class="field-error">${esc(msg)}</small>`);
            } else { err.textContent = msg; err.hidden = false; }
          });
          const first = form.querySelector('.invalid');
          if (first) first.focus();
        } else {
          err.textContent = ex.message || String(ex);
          err.hidden = false;
        }
      }
    });

    if (opts.onOpen) opts.onOpen(dialog, form);
    const first = dialog.querySelector('[autofocus], input:not([type=hidden]), textarea, select');
    if (first) setTimeout(() => first.focus(), 30);
    return dialog;
  }

  /** Collect form values: checkboxes → boolean, everything else → string. */
  function readForm(form) {
    const out = {};
    form.querySelectorAll('[name]').forEach((el) => {
      if (el.dataset.ignore !== undefined) return;
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else out[el.name] = el.value;
    });
    return out;
  }

  function confirmDialog({ title = 'Are you sure?', message, confirmLabel = 'Delete', danger = true }) {
    return new Promise((resolve) => {
      let answered = false;
      openModal({
        title,
        body: `<p class="confirm-text">${message}</p>`,
        submitLabel: confirmLabel,
        danger,
        onSubmit: () => { answered = true; resolve(true); }
      });
      const root = $('#modal-root');
      const obs = new MutationObserver(() => {
        if (root.hidden) { obs.disconnect(); if (!answered) resolve(false); }
      });
      obs.observe(root, { attributes: true, attributeFilter: ['hidden'] });
    });
  }

  /* ---------- form field builders ---------- */
  const F = {
    text(name, label, value = '', attrs = '') {
      return `<label class="field"><span>${esc(label)}</span><input type="text" name="${name}" value="${esc(value)}" ${attrs}></label>`;
    },
    textarea(name, label, value = '', attrs = '') {
      return `<label class="field"><span>${esc(label)}</span><textarea name="${name}" ${attrs}>${esc(value)}</textarea></label>`;
    },
    input(type, name, label, value = '', attrs = '') {
      return `<label class="field"><span>${esc(label)}</span><input type="${type}" name="${name}" value="${esc(value == null ? '' : value)}" ${attrs}></label>`;
    },
    select(name, label, options, value, attrs = '') {
      const opts = options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, U.capitalize(o)];
        return `<option value="${esc(v)}" ${String(v) === String(value == null ? '' : value) ? 'selected' : ''}>${esc(l)}</option>`;
      }).join('');
      return `<label class="field"><span>${esc(label)}</span><select name="${name}" ${attrs}>${opts}</select></label>`;
    },
    checkbox(name, label, checked) {
      return `<label class="check"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span>${esc(label)}</span></label>`;
    },
    courseOptions(includeNone = true, noneLabel = 'No course') {
      const list = UT.DB.all('courses', { sort: (a, b) => a.name.localeCompare(b.name) }).map((c) => [c.id, c.name]);
      return includeNone ? [['', noneLabel]].concat(list) : list;
    }
  };

  /* ---------- small visual pieces ---------- */
  const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };
  const STATUS_LABEL = { todo: 'To do', in_progress: 'In progress', done: 'Done' };

  function courseChip(course) {
    if (!course) return '<span class="chip chip-muted">No course</span>';
    return `<span class="chip"><i class="dot" style="background:${esc(course.color)}"></i>${esc(course.name)}</span>`;
  }
  function priorityBadge(p) {
    return `<span class="prio prio-${p}" title="Priority: ${PRIORITY_LABEL[p]}">${icon('flag')}${PRIORITY_LABEL[p]}</span>`;
  }
  function statusBadge(s) { return `<span class="status status-${s}">${STATUS_LABEL[s]}</span>`; }
  function dueBadge(task) {
    if (!task.dueDate) return '<span class="due muted">No deadline</span>';
    const n = U.daysUntil(task.dueDate);
    const cls = task.status === 'done' ? 'due-done' : n < 0 ? 'due-overdue' : n <= 2 ? 'due-soon' : '';
    const label = task.status === 'done' ? U.formatDate(task.dueDate) : U.relativeDue(task.dueDate);
    return `<span class="due ${cls}" title="${esc(U.formatDate(task.dueDate, { weekday: true, year: true }))}${task.dueTime ? ' ' + task.dueTime : ''}">${icon(n < 0 && task.status !== 'done' ? 'alert' : 'clock')}${esc(label)}${task.dueTime && task.status !== 'done' && n >= 0 && n <= 1 ? ', ' + task.dueTime : ''}</span>`;
  }
  function empty(title, text, actionHtml = '') {
    return `<div class="empty"><div class="empty-art">${icon('tasks')}</div><h3>${esc(title)}</h3><p class="muted">${esc(text)}</p>${actionHtml}</div>`;
  }
  /** Human-readable summary of a delete plan from DB.previewDelete */
  function describeDeletePlan(plan) {
    const names = { tasks: 'task', subtasks: 'subtask', classes: 'class', notes: 'note', courses: 'course' };
    const parts = [];
    Object.entries(plan.cascade).forEach(([t, n]) => parts.push(`<li><b>${U.plural(n, names[t], t === 'classes' ? 'classes' : undefined)}</b> will also be deleted</li>`));
    Object.entries(plan.unlink).forEach(([t, n]) => parts.push(`<li>${U.plural(n, names[t], t === 'classes' ? 'classes' : undefined)} will be kept but unlinked</li>`));
    return parts.length ? `<ul class="plan">${parts.join('')}</ul>` : '';
  }

  UT.UI = {
    $, icon, toast, openModal, closeModal, confirm: confirmDialog, readForm, F,
    courseChip, priorityBadge, statusBadge, dueBadge, empty, describeDeletePlan,
    PRIORITY_LABEL, STATUS_LABEL
  };
})(globalThis.UT = globalThis.UT || {});
