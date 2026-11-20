/* UniTask — pages/schedule.js
 * Weekly timetable: view and manage classes, times and locations.
 * Desktop: time grid. Phone: list grouped by day.
 */
(function (UT) {
  'use strict';

  const { U, DB, UI } = UT;
  const esc = U.esc;
  const KINDS = [['lecture', 'Lecture'], ['practice', 'Practice'], ['lab', 'Lab'], ['seminar', 'Seminar']];

  function overlaps(row, ignoreId) {
    const s = U.timeToMin(row.startTime);
    const e = U.timeToMin(row.endTime);
    return DB.all('classes').find((c) => c.id !== ignoreId && c.day === Number(row.day) &&
      U.timeToMin(c.startTime) < e && s < U.timeToMin(c.endTime));
  }

  function openClassEditor(cls, defaults = {}) {
    if (!DB.count('courses')) {
      UI.toast('Create a course first — every class belongs to a course', 'error');
      UT.openCourseEditor(null);
      return;
    }
    const isNew = !cls;
    const c = cls || Object.assign({ day: U.isoWeekday(new Date()), startTime: '09:00', endTime: '10:30', kind: 'lecture' }, defaults);
    UI.openModal({
      title: isNew ? 'Add class' : 'Edit class',
      submitLabel: isNew ? 'Add to schedule' : 'Save changes',
      body: `
        ${UI.F.select('courseId', 'Course', UI.F.courseOptions(false), c.courseId)}
        <div class="grid-2">
          ${UI.F.select('day', 'Day', U.DAY_NAMES.map((n, i) => [i + 1, n]), c.day)}
          ${UI.F.select('kind', 'Type', KINDS, c.kind)}
        </div>
        <div class="grid-2">
          ${UI.F.input('time', 'startTime', 'Starts', c.startTime, 'required step="300"')}
          ${UI.F.input('time', 'endTime', 'Ends', c.endTime, 'required step="300"')}
        </div>
        ${UI.F.text('location', 'Location', c.location, 'placeholder="e.g. Room 301, Lab 4, Zoom" maxlength="60"')}`,
      footerExtra: isNew ? '' : `<button type="button" class="btn btn-ghost btn-danger-text" id="cls-del">${UI.icon('trash')}Delete</button>`,
      onOpen(dialog) {
        const del = dialog.querySelector('#cls-del');
        if (del) del.addEventListener('click', () => { UI.closeModal(); UT.actions.remove('classes', c.id, 'this class'); });
      },
      onSubmit(values) {
        values.day = Number(values.day);
        const clash = values.startTime && values.endTime && values.endTime > values.startTime && overlaps(values, c.id);
        if (clash) {
          const other = DB.get('courses', clash.courseId);
          throw new DB.ValidationError({ startTime: `Overlaps with ${other ? other.name : 'another class'} (${clash.startTime}–${clash.endTime})` });
        }
        if (isNew) DB.insert('classes', values); else DB.update('classes', c.id, values);
        UI.toast(isNew ? 'Class added' : 'Class saved', 'success');
      }
    });
  }

  let els = null;
  const page = {
    title: 'Schedule',
    subtitle() {
      const mins = DB.all('classes').reduce((s, c) => s + U.timeToMin(c.endTime) - U.timeToMin(c.startTime), 0);
      return `${U.plural(DB.count('classes'), 'class', 'classes')} per week · ${(mins / 60).toFixed(1).replace('.0', '')} h in class`;
    },
    actions: () => `<button class="btn btn-primary" id="add-class">${UI.icon('plus')}<span>Add class</span></button>`,

    mount(view) {
      view.innerHTML = `<div id="sched"></div>`;
      els = { box: view.querySelector('#sched') };
      document.getElementById('add-class').addEventListener('click', () => openClassEditor(null));
      view.addEventListener('click', (e) => {
        const b = e.target.closest('[data-class]');
        if (b) { openClassEditor(DB.get('classes', b.dataset.class)); return; }
        const slot = e.target.closest('[data-slot]');
        if (slot) {
          const [day, hour] = slot.dataset.slot.split('|').map(Number);
          openClassEditor(null, { day, startTime: U.minToTime(hour * 60), endTime: U.minToTime(hour * 60 + 90) });
        }
        if (e.target.closest('[data-new-class]')) openClassEditor(null);
      });
      page.update();
    },

    update() {
      const s = DB.settings();
      const classes = DB.all('classes');
      const courses = DB.index('courses');
      if (!classes.length) {
        els.box.innerHTML = `<div class="card">${UI.empty('Your week is empty', 'Add lectures, labs and seminars to build your weekly timetable.',
          `<button class="btn btn-primary" data-new-class>${UI.icon('plus')}Add class</button>`)}</div>`;
        return;
      }
      const hasWeekend = classes.some((c) => c.day > 5);
      const days = s.showWeekend || hasWeekend ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5];
      let startH = Math.floor(U.timeToMin(s.dayStart || '08:00') / 60);
      let endH = Math.ceil(U.timeToMin(s.dayEnd || '19:00') / 60);
      classes.forEach((c) => {
        startH = Math.min(startH, Math.floor(U.timeToMin(c.startTime) / 60));
        endH = Math.max(endH, Math.ceil(U.timeToMin(c.endTime) / 60));
      });
      const HOUR = 56; // px per hour
      const todayWd = U.isoWeekday(new Date());
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const weekStart = U.startOfWeek(new Date());

      const block = (c) => {
        const course = courses.get(c.courseId);
        const top = ((U.timeToMin(c.startTime) - startH * 60) / 60) * HOUR;
        const h = ((U.timeToMin(c.endTime) - U.timeToMin(c.startTime)) / 60) * HOUR;
        return `<button type="button" class="cls kind-${c.kind}" data-class="${c.id}" style="top:${top}px;height:${h - 3}px;--course:${esc(course ? course.color : '#888')}"
            title="${esc(course ? course.name : '')} · ${c.startTime}–${c.endTime}${c.location ? ' · ' + esc(c.location) : ''}">
          <b>${esc(course ? course.name : 'Class')}</b>
          <small>${c.startTime}–${c.endTime}</small>
          <small>${U.capitalize(c.kind)}${c.location ? ' · ' + esc(c.location) : ''}</small>
        </button>`;
      };

      const hours = [];
      for (let h = startH; h < endH; h++) hours.push(h);

      const grid = `
        <div class="card card-flush week-wrap">
          <div class="week" style="--cols:${days.length};--hour:${HOUR}px">
            <div class="week-head"><span></span>${days.map((d) => {
              const date = U.addDays(weekStart, d - 1);
              return `<span class="${d === todayWd ? 'today' : ''}">${U.DAY_SHORT[d - 1]}<small>${date.getDate()} ${U.MONTH_SHORT[date.getMonth()]}</small></span>`;
            }).join('')}</div>
            <div class="week-body" style="height:${(endH - startH) * HOUR}px">
              <div class="hours">${hours.map((h) => `<span style="top:${(h - startH) * HOUR}px">${String(h).padStart(2, '0')}:00</span>`).join('')}</div>
              ${days.map((d) => `
                <div class="day-col ${d === todayWd ? 'today' : ''}">
                  ${hours.map((h) => `<button type="button" class="slot" data-slot="${d}|${h}" style="top:${(h - startH) * HOUR}px" aria-label="Add class on ${U.DAY_NAMES[d - 1]} at ${h}:00"></button>`).join('')}
                  ${classes.filter((c) => c.day === d).map(block).join('')}
                  ${d === todayWd && nowMin >= startH * 60 && nowMin <= endH * 60 ? `<i class="now-line" style="top:${((nowMin - startH * 60) / 60) * HOUR}px"></i>` : ''}
                </div>`).join('')}
            </div>
          </div>
        </div>`;

      const list = `
        <div class="day-list">
          ${days.map((d) => {
            const items = classes.filter((c) => c.day === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
            return `<section class="card ${d === todayWd ? 'is-today' : ''}"><h3>${U.DAY_NAMES[d - 1]}${d === todayWd ? ' <span class="pill">Today</span>' : ''}</h3>
              ${items.length ? `<ol class="timeline">${items.map((c) => {
                const course = courses.get(c.courseId);
                return `<li style="--course:${esc(course ? course.color : '#888')}"><button type="button" data-class="${c.id}" class="tl-btn">
                  <span class="tl-time">${c.startTime}<small>${c.endTime}</small></span>
                  <span class="tl-body"><b>${esc(course ? course.name : 'Class')}</b><small class="muted">${U.capitalize(c.kind)}${c.location ? ' · ' + esc(c.location) : ''}</small></span></button></li>`;
              }).join('')}</ol>` : '<p class="muted small">No classes</p>'}</section>`;
          }).join('')}
        </div>`;

      // weekly load per course
      const load = new Map();
      classes.forEach((c) => load.set(c.courseId, (load.get(c.courseId) || 0) + U.timeToMin(c.endTime) - U.timeToMin(c.startTime)));
      const legend = `<div class="legend-row">${[...load.entries()].sort((a, b) => b[1] - a[1]).map(([id, m]) => {
        const c = courses.get(id);
        return `<span class="chip"><i class="dot" style="background:${esc(c ? c.color : '#888')}"></i>${esc(c ? c.name : '—')}<em class="muted">${(m / 60).toFixed(1).replace('.0', '')} h</em></span>`;
      }).join('')}</div>`;

      els.box.innerHTML = legend + grid + list;
    }
  };

  UT.pages = UT.pages || {};
  UT.pages.schedule = page;
  UT.openClassEditor = openClassEditor;
})(globalThis.UT = globalThis.UT || {});
