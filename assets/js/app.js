/* UniTask — app.js
 * Application bootstrap: hash router, theme, navigation, shared actions
 * (delete with confirmation) and the global tooltip.
 */
(function (UT) {
  'use strict';

  const { U, DB, UI } = UT;
  const $ = UI.$;
  const ROUTES = ['dashboard', 'tasks', 'schedule', 'notes', 'courses', 'progress', 'settings'];
  let current = null;

  /* ---------- theme ---------- */
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  UT.applyTheme = function () {
    const pref = DB.settings().theme;
    const theme = pref === 'system' ? (media.matches ? 'dark' : 'light') : pref;
    document.documentElement.setAttribute('data-theme', theme);
  };
  media.addEventListener('change', () => { if (DB.settings().theme === 'system') UT.applyTheme(); });

  /* ---------- shared actions ---------- */
  UT.actions = {
    /** Delete with a confirmation that explains cascades (ON DELETE rules). */
    async remove(table, id, label) {
      const plan = DB.previewDelete(table, id);
      const details = UI.describeDeletePlan(plan);
      const nouns = { tasks: 'task', notes: 'note', classes: 'class', courses: 'course' };
      if (DB.settings().confirmDelete || details) {
        const ok = await UI.confirm({
          title: `Delete ${nouns[table]}?`,
          message: `<b>${U.esc(label)}</b> will be permanently deleted.${details}`,
          confirmLabel: 'Delete'
        });
        if (!ok) return;
      }
      DB.remove(table, id);
      UI.toast(`${U.capitalize(nouns[table])} deleted`, 'success');
    }
  };

  /* ---------- router ---------- */
  function route() {
    const raw = (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'dashboard';
    const name = raw === 'prefs' ? 'settings' : raw; // alias used by the single-file (embedded) build
    const key = ROUTES.includes(name) ? name : 'dashboard';
    const page = UT.pages[key];
    current = page;
    UI.closeModal();

    document.querySelectorAll('#nav a').forEach((a) => {
      const active = a.dataset.route === key;
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('#page-title').textContent = page.title;
    $('#page-subtitle').textContent = page.subtitle ? page.subtitle() : '';
    $('#page-actions').innerHTML = page.actions ? page.actions() : '';
    document.title = `${page.title} · UniTask`;

    // a fresh <main> each time drops the previous page's event listeners
    const old = $('#view');
    const view = old.cloneNode(false);
    old.replaceWith(view);
    view.className = `view view-${key}`;
    page.mount(view);
    closeSidebar();
    window.scrollTo(0, 0);
    updateBadges();
  }

  function updateBadges() {
    const n = DB.count('tasks', (t) => t.status !== 'done' && t.dueDate && U.daysUntil(t.dueDate) < 0);
    const b = $('#badge-tasks');
    b.hidden = !n;
    b.textContent = n;
    b.title = `${n} overdue`;
  }

  /* ---------- mobile sidebar ---------- */
  function openSidebar() { $('#sidebar').classList.add('open'); $('#scrim').hidden = false; }
  function closeSidebar() { $('#sidebar').classList.remove('open'); $('#scrim').hidden = true; }

  /* ---------- tooltip for [data-tip] (charts) ---------- */
  function initTooltip() {
    const tip = document.createElement('div');
    tip.className = 'tooltip';
    tip.hidden = true;
    document.body.appendChild(tip);
    const show = (el, x, y) => {
      tip.textContent = el.dataset.tip;
      tip.hidden = false;
      const r = tip.getBoundingClientRect();
      tip.style.left = `${U.clamp(x - r.width / 2, 8, window.innerWidth - r.width - 8)}px`;
      tip.style.top = `${Math.max(8, y - r.height - 12)}px`;
    };
    document.addEventListener('pointermove', (e) => {
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (el) show(el, e.clientX, e.clientY); else tip.hidden = true;
    });
    document.addEventListener('focusin', (e) => {
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (el) { const r = el.getBoundingClientRect(); show(el, r.left + r.width / 2, r.top); } else tip.hidden = true;
    });
    document.addEventListener('scroll', () => { tip.hidden = true; }, true);
  }

  /* ---------- boot ---------- */
  function start() {
    const { firstRun } = DB.init();
    UT.applyTheme();

    DB.subscribe((evt) => {
      if (!current) return;
      if (evt.table === 'settings' && current === UT.pages.settings) { current.update(); return; }
      $('#page-subtitle').textContent = current.subtitle ? current.subtitle() : '';
      current.update();
      updateBadges();
    });

    $('#menu-btn').addEventListener('click', openSidebar);
    $('#scrim').addEventListener('click', closeSidebar);
    $('#theme-toggle').addEventListener('click', () => {
      const now = document.documentElement.getAttribute('data-theme');
      DB.saveSettings({ theme: now === 'dark' ? 'light' : 'dark' });
      UT.applyTheme();
    });
    // keyboard shortcut: "n" = new item on the current page
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || !$('#modal-root').hidden) return;
      const btn = $('#page-actions .btn-primary');
      if (btn) { e.preventDefault(); btn.click(); }
    });

    window.addEventListener('hashchange', route);
    initTooltip();
    route();

    if (firstRun) setTimeout(() => UI.toast('Welcome to UniTask! Demo data has been loaded — reset it any time in Settings.'), 400);
    if (!DB.persistent) UI.toast('Browser storage is unavailable: changes will not be saved', 'error');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(globalThis.UT = globalThis.UT || {});
