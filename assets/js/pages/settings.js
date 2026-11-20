/* UniTask — pages/settings.js
 * Preferences (profile, theme, schedule) and data management:
 * export / import a JSON backup, reset demo data, and a read-only
 * "database inspector" that shows what is stored in LocalStorage.
 */
(function (UT) {
  'use strict';

  const { U, DB, UI } = UT;
  const esc = U.esc;
  let inspect = 'tasks';

  const kb = (bytes) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);

  function download(filename, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  let root = null;
  const page = {
    title: 'Settings',
    subtitle: () => 'Preferences and data',
    actions: () => '',

    mount(view) {
      root = view;
      view.addEventListener('change', (e) => {
        const el = e.target;
        if (el.id === 'inspect-table') { inspect = el.value; page.update(); return; }
        if (!el.name || el.closest('#import-form')) return;
        if (el.name === 'dayStart' || el.name === 'dayEnd') {
          const s = DB.settings();
          const next = Object.assign({}, s, { [el.name]: el.value });
          if (!el.value || next.dayEnd <= next.dayStart) { UI.toast('Day end must be after day start', 'error'); el.value = s[el.name]; return; }
        }
        let v = el.type === 'checkbox' ? el.checked : el.value;
        if (el.name === 'upcomingDays') v = U.clamp(Number(v) || 7, 1, 60);
        if (el.name === 'userName') v = v.trim().slice(0, 40) || 'Student';
        if (el.name === 'university') v = v.trim().slice(0, 80);
        DB.saveSettings({ [el.name]: v });
        if (el.name === 'theme') UT.applyTheme();
        UI.toast('Settings saved', 'success');
      });
      view.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-do]');
        if (!b) return;
        const act = b.dataset.do;
        if (act === 'export') {
          download(`unitask-backup-${U.todayISO()}.json`, JSON.stringify(DB.exportData(), null, 2));
          UI.toast('Backup downloaded', 'success');
        }
        if (act === 'import') root.querySelector('#import-file').click();
        if (act === 'demo') {
          if (await UI.confirm({ title: 'Reset demo data?', message: 'All your current data will be replaced with the sample semester.', confirmLabel: 'Reset' })) {
            DB.reset({ withDemo: true });
            UI.toast('Demo data restored', 'success');
          }
        }
        if (act === 'clear') {
          if (await UI.confirm({ title: 'Delete all data?', message: 'Every course, task, class and note in this browser will be permanently removed. Export a backup first if you need it.', confirmLabel: 'Delete everything' })) {
            DB.reset({ withDemo: false });
            UI.toast('All data deleted', 'success');
          }
        }
        if (act === 'check') {
          const p = DB.integrityCheck();
          UI.toast(p.length ? `${p.length} broken reference(s) found` : 'Integrity check passed: all foreign keys are valid', p.length ? 'error' : 'success');
        }
      });
      view.addEventListener('change', (e) => {
        if (e.target.id !== 'import-file' || !e.target.files[0]) return;
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const data = JSON.parse(reader.result);
            const counts = Object.entries(data.tables || {}).map(([t, rows]) => `${rows.length} ${t}`).join(', ');
            if (await UI.confirm({ title: 'Import backup?', message: `This replaces all current data with: ${esc(counts)}.`, confirmLabel: 'Import', danger: false })) {
              DB.importData(data);
              UT.applyTheme();
              UI.toast('Backup imported', 'success');
            }
          } catch (ex) {
            UI.toast(`Import failed: ${ex.message}`, 'error');
          }
          e.target.value = '';
        };
        reader.readAsText(file);
      });
      page.update();
    },

    update() {
      const s = DB.settings();
      const info = DB.storageInfo();
      const problems = DB.integrityCheck();
      const rows = DB.all(inspect).slice(0, 5);
      const theme = (v, label, ic) => `<label class="seg-opt"><input type="radio" name="theme" value="${v}" ${s.theme === v ? 'checked' : ''}><span>${UI.icon(ic)}${label}</span></label>`;

      root.innerHTML = `
        <div class="settings-grid">
          <section class="card">
            <h2 class="card-title">Profile</h2>
            <div class="grid-2">
              ${UI.F.text('userName', 'Your name', s.userName, 'maxlength="40"')}
              ${UI.F.text('university', 'University', s.university, 'maxlength="80" placeholder="optional"')}
            </div>
            <h2 class="card-title mt">Appearance</h2>
            <div class="segmented" role="radiogroup" aria-label="Theme">
              ${theme('light', 'Light', 'sun')}${theme('dark', 'Dark', 'moon')}${theme('system', 'System', 'settings')}
            </div>
            <h2 class="card-title mt">Schedule & dashboard</h2>
            <div class="grid-3">
              ${UI.F.input('time', 'dayStart', 'Day starts', s.dayStart)}
              ${UI.F.input('time', 'dayEnd', 'Day ends', s.dayEnd)}
              ${UI.F.input('number', 'upcomingDays', 'Upcoming window (days)', s.upcomingDays, 'min="1" max="60"')}
            </div>
            ${UI.F.checkbox('showWeekend', 'Show Saturday and Sunday in the weekly schedule', s.showWeekend)}
            ${UI.F.checkbox('confirmDelete', 'Ask for confirmation before deleting', s.confirmDelete)}
          </section>

          <section class="card">
            <h2 class="card-title">${UI.icon('db')}Data & storage</h2>
            <p class="small muted">${info.persistent ? 'Everything is stored in this browser’s <b>LocalStorage</b> — nothing is sent to a server.' : '<b class="text-critical">Storage is blocked in this browser</b> — data lives in memory and is lost when the tab closes.'}
              Used: <b>${kb(info.totalBytes)}</b> of ~5 MB.</p>
            <table class="data">
              <thead><tr><th>Table</th><th>LocalStorage key</th><th class="num">Rows</th><th class="num">Size</th></tr></thead>
              <tbody>${info.tables.map((t) => `<tr><td>${esc(t.label)}</td><td><code>${esc(t.key)}</code></td><td class="num">${t.rows}</td><td class="num">${kb(t.bytes)}</td></tr>`).join('')}
              <tr><td>Settings</td><td><code>unitask.v1.settings</code></td><td class="num">1</td><td class="num">—</td></tr></tbody>
            </table>
            <p class="small ${problems.length ? 'text-critical' : 'text-good'}">${UI.icon(problems.length ? 'alert' : 'check')}
              ${problems.length ? `${problems.length} broken foreign key reference(s)` : 'Referential integrity OK — every foreign key points to an existing row'} · schema v${info.meta.schemaVersion}</p>
            <div class="btn-row">
              <button class="btn btn-ghost" data-do="export">${UI.icon('download')}Export JSON</button>
              <button class="btn btn-ghost" data-do="import">${UI.icon('upload')}Import JSON</button>
              <button class="btn btn-ghost" data-do="check">${UI.icon('check')}Check integrity</button>
            </div>
            <form id="import-form" hidden><input type="file" id="import-file" accept="application/json,.json"></form>
            <div class="btn-row">
              <button class="btn btn-ghost" data-do="demo">Reset demo data</button>
              <button class="btn btn-ghost btn-danger-text" data-do="clear">${UI.icon('trash')}Delete all data</button>
            </div>
          </section>

          <section class="card span-2">
            <h2 class="card-title">Database inspector <span class="muted small">read-only view of raw LocalStorage rows</span></h2>
            <div class="toolbar-row">
              <select id="inspect-table" aria-label="Table">${DB.TABLE_ORDER.map((t) => `<option value="${t}" ${t === inspect ? 'selected' : ''}>${t}</option>`).join('')}</select>
              <span class="muted small">Showing ${rows.length} of ${DB.count(inspect)} rows from <code>unitask.v1.${inspect}</code></span>
            </div>
            <pre class="json">${esc(JSON.stringify(rows, null, 2))}</pre>
          </section>
        </div>`;
    }
  };

  UT.pages = UT.pages || {};
  UT.pages.settings = page;
})(globalThis.UT = globalThis.UT || {});
