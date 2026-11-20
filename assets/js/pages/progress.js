/* UniTask — pages/progress.js
 * Basic task-completion statistics, drawn with plain SVG / CSS (no chart library).
 */
(function (UT) {
  'use strict';

  const { U, DB, UI } = UT;
  const esc = U.esc;

  /** Daily completions for the last `days` days (oldest → newest). */
  function completionsByDay(tasks, days) {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const iso = U.toISODate(U.addDays(U.today(), -i));
      out.push({ iso, n: tasks.filter((t) => t.completedAt && U.toISODate(new Date(t.completedAt)) === iso).length });
    }
    return out;
  }

  function columnChart(series) {
    const W = 640;
    const H = 200;
    const pad = { l: 28, r: 8, t: 12, b: 26 };
    const max = Math.max(2, ...series.map((d) => d.n));
    const ticks = max <= 4 ? max : 4;
    const step = Math.ceil(max / ticks);
    const top = step * ticks;
    const cw = (W - pad.l - pad.r) / series.length;
    const bw = Math.min(26, cw - 6);
    const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / top);
    let grid = '';
    for (let v = 0; v <= top; v += step) {
      grid += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="${v === 0 ? 'axis' : 'gridline'}"/>
        <text x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end" class="tick">${v}</text>`;
    }
    const bars = series.map((d, i) => {
      const x = pad.l + i * cw + (cw - bw) / 2;
      const h = y(0) - y(d.n);
      const date = U.parseDate(d.iso);
      const label = i % 2 === (series.length - 1) % 2 ? `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" class="tick">${date.getDate()}</text>` : '';
      const tip = `${U.formatDate(d.iso, { weekday: true })}: ${U.plural(d.n, 'task')} completed`;
      // rounded top only (data end), square at the baseline
      const r = Math.min(4, h);
      const path = d.n ? `<path class="bar" d="M${x},${y(0)} V${y(d.n) + r} Q${x},${y(d.n)} ${x + r},${y(d.n)} H${x + bw - r} Q${x + bw},${y(d.n)} ${x + bw},${y(d.n) + r} V${y(0)} Z"/>` : '';
      return `<g class="col" data-tip="${esc(tip)}" tabindex="0"><rect x="${pad.l + i * cw}" y="${pad.t}" width="${cw}" height="${H - pad.t - pad.b}" class="hit"/>${path}${label}</g>`;
    }).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tasks completed per day over the last ${series.length} days">${grid}${bars}</svg>`;
  }

  let root = null;
  const page = {
    title: 'Progress',
    subtitle: () => 'Task-completion statistics',
    actions: () => '',

    mount(view) {
      root = view;
      page.update();
    },

    update() {
      const tasks = DB.all('tasks');
      const courses = DB.all('courses', { sort: (a, b) => a.name.localeCompare(b.name) });
      if (!tasks.length) {
        root.innerHTML = `<div class="card">${UI.empty('No data yet', 'Statistics appear once you add and complete tasks.', '<a class="btn btn-primary" href="#/tasks">Go to tasks</a>')}</div>`;
        return;
      }
      const done = tasks.filter((t) => t.status === 'done');
      const open = tasks.filter((t) => t.status !== 'done');
      const withDue = done.filter((t) => t.dueDate && t.completedAt);
      const onTime = withDue.filter((t) => U.toISODate(new Date(t.completedAt)) <= t.dueDate).length;
      const last7 = done.filter((t) => t.completedAt && Date.now() - new Date(t.completedAt) < 7 * 864e5).length;
      const prev7 = done.filter((t) => t.completedAt && Date.now() - new Date(t.completedAt) >= 7 * 864e5 && Date.now() - new Date(t.completedAt) < 14 * 864e5).length;
      const hoursLeft = open.reduce((s, t) => s + (t.estimatedHours || 0), 0);
      const overdue = open.filter((t) => t.dueDate && U.daysUntil(t.dueDate) < 0).length;
      const series = completionsByDay(tasks, 14);
      const delta = last7 - prev7;

      const byCourse = courses.map((c) => {
        const ct = tasks.filter((t) => t.courseId === c.id);
        return { c, total: ct.length, done: ct.filter((t) => t.status === 'done').length };
      }).filter((x) => x.total);
      const none = tasks.filter((t) => !t.courseId);
      if (none.length) byCourse.push({ c: null, total: none.length, done: none.filter((t) => t.status === 'done').length });

      const prios = ['high', 'medium', 'low'].map((p) => ({
        p, open: open.filter((t) => t.priority === p).length, done: done.filter((t) => t.priority === p).length
      }));
      const prioMax = Math.max(1, ...prios.map((x) => x.open + x.done));
      const statuses = [['todo', 'To do'], ['in_progress', 'In progress'], ['done', 'Done']].map(([s, l]) => [l, tasks.filter((t) => t.status === s).length]);

      root.innerHTML = `
        <section class="stats">
          <div class="stat"><span class="stat-label">${UI.icon('check')}Completion rate</span><b class="stat-value">${U.pct(done.length, tasks.length)}%</b><span class="muted small">${done.length} of ${tasks.length} tasks</span></div>
          <div class="stat"><span class="stat-label">${UI.icon('activity')}Last 7 days</span><b class="stat-value">${last7}</b><span class="muted small">${delta === 0 ? 'same as the week before' : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)} vs the week before`}</span></div>
          <div class="stat"><span class="stat-label">${UI.icon('clock')}On time</span><b class="stat-value">${withDue.length ? U.pct(onTime, withDue.length) + '%' : '—'}</b><span class="muted small">${onTime} of ${withDue.length} finished before the deadline</span></div>
          <div class="stat ${overdue ? 'stat-critical' : ''}"><span class="stat-label">${UI.icon('alert')}Work remaining</span><b class="stat-value">${hoursLeft ? hoursLeft + ' h' : open.length}</b><span class="muted small">${hoursLeft ? `estimated across ${U.plural(open.length, 'open task')}` : 'open tasks'}${overdue ? ` · ${overdue} overdue` : ''}</span></div>
        </section>

        <div class="progress-grid">
          <section class="card chart-card">
            <h2 class="card-title">Tasks completed per day <span class="muted small">last 14 days</span></h2>
            ${columnChart(series)}
            <details class="table-view"><summary>Show as table</summary>
              <table class="data"><thead><tr><th>Date</th><th class="num">Completed</th></tr></thead><tbody>
              ${series.slice().reverse().map((d) => `<tr><td>${U.formatDate(d.iso, { weekday: true })}</td><td class="num">${d.n}</td></tr>`).join('')}
              </tbody></table></details>
          </section>

          <section class="card">
            <h2 class="card-title">By status</h2>
            <ul class="status-list">
              ${statuses.map(([l, n]) => `<li><span>${l}</span><span class="bar-line thin"><span style="width:${U.pct(n, tasks.length)}%"></span></span><b>${n}</b></li>`).join('')}
            </ul>
            <h2 class="card-title mt">By priority</h2>
            <div class="legend"><span><i class="sw sw-done"></i>Done</span><span><i class="sw sw-open"></i>Open</span></div>
            <ul class="prio-bars">
              ${prios.map((x) => `<li data-tip="${UI.PRIORITY_LABEL[x.p]} priority: ${x.done} done, ${x.open} open" tabindex="0">
                <span class="lbl">${UI.PRIORITY_LABEL[x.p]}</span>
                <span class="stack-bar"><span class="seg seg-done" style="width:${(x.done / prioMax) * 100}%"></span><span class="seg seg-open" style="width:${(x.open / prioMax) * 100}%"></span></span>
                <span class="val">${x.done}/${x.open + x.done}</span></li>`).join('')}
            </ul>
          </section>

          <section class="card span-2">
            <h2 class="card-title">Completion by course</h2>
            <ul class="course-bars">
              ${byCourse.map(({ c, total, done: d }) => `<li data-tip="${esc(c ? c.name : 'No course')}: ${d} of ${total} done" tabindex="0">
                <span class="lbl"><i class="dot" style="background:${esc(c ? c.color : 'var(--text-muted)')}"></i>${esc(c ? c.name : 'No course')}</span>
                <span class="track"><span style="width:${U.pct(d, total)}%;background:${esc(c ? c.color : 'var(--text-muted)')}"></span></span>
                <span class="val"><b>${U.pct(d, total)}%</b> <small class="muted">${d}/${total}</small></span></li>`).join('')}
            </ul>
          </section>
        </div>`;
    }
  };

  UT.pages = UT.pages || {};
  UT.pages.progress = page;
})(globalThis.UT = globalThis.UT || {});
