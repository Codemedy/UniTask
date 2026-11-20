/* UniTask — utils.js
 * Small, dependency-free helpers shared by every module:
 * ids, HTML escaping, date/time maths and formatting.
 */
(function (UT) {
  'use strict';

  const DAY_MS = 86400000;
  const pad = (n) => String(n).padStart(2, '0');

  const U = {
    DAY_NAMES: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    DAY_SHORT: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    MONTH_SHORT: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

    /** Unique id with a table prefix, e.g. "tsk_lq2k9x3f8a1b" */
    uid(prefix) {
      const rnd = Math.random().toString(36).slice(2, 8);
      return `${prefix}_${Date.now().toString(36)}${rnd}`;
    },

    /** Escape text before inserting it into HTML (prevents XSS from user input). */
    esc(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    },

    /* ---------- dates (all "date" values are local YYYY-MM-DD strings) ---------- */
    toISODate(d) {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    },
    parseDate(iso) {
      const [y, m, d] = String(iso).split('-').map(Number);
      return new Date(y, m - 1, d);
    },
    today() {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    },
    todayISO() { return U.toISODate(new Date()); },
    addDays(date, n) {
      const d = new Date(date);
      d.setDate(d.getDate() + n);
      return d;
    },
    isoPlusDays(n) { return U.toISODate(U.addDays(U.today(), n)); },
    /** Whole days from today until the date (negative = in the past). */
    daysUntil(iso) {
      return Math.round((U.parseDate(iso) - U.today()) / DAY_MS);
    },
    /** 1 = Monday … 7 = Sunday (ISO weekday) */
    isoWeekday(date) {
      const wd = date.getDay();
      return wd === 0 ? 7 : wd;
    },
    startOfWeek(date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return U.addDays(d, 1 - U.isoWeekday(d));
    },
    formatDate(iso, opts = {}) {
      if (!iso) return '';
      const d = U.parseDate(iso);
      const base = `${d.getDate()} ${U.MONTH_SHORT[d.getMonth()]}`;
      const withDay = opts.weekday ? `${U.DAY_SHORT[U.isoWeekday(d) - 1]}, ${base}` : base;
      return opts.year ? `${withDay} ${d.getFullYear()}` : withDay;
    },
    formatDateTime(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      return `${U.formatDate(U.toISODate(d))}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },
    /** Human label for a deadline: "Today", "Tomorrow", "In 3 days", "2 days overdue". */
    relativeDue(iso) {
      const n = U.daysUntil(iso);
      if (n === 0) return 'Today';
      if (n === 1) return 'Tomorrow';
      if (n === -1) return 'Yesterday';
      if (n > 1) return n < 7 ? `In ${n} days` : U.formatDate(iso, { weekday: true });
      return `${-n} days overdue`;
    },
    timeAgo(ts) {
      const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
      if (s < 60) return 'just now';
      if (s < 3600) return `${Math.floor(s / 60)} min ago`;
      if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
      const d = Math.floor(s / 86400);
      return d === 1 ? 'yesterday' : `${d} days ago`;
    },

    /* ---------- time of day ("HH:MM") ---------- */
    timeToMin(t) {
      const [h, m] = String(t).split(':').map(Number);
      return h * 60 + m;
    },
    minToTime(min) { return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`; },

    /* ---------- misc ---------- */
    debounce(fn, ms = 200) {
      let t;
      return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    },
    clamp(n, a, b) { return Math.min(b, Math.max(a, n)); },
    pct(part, whole) { return whole ? Math.round((part / whole) * 100) : 0; },
    plural(n, one, many) { return `${n} ${n === 1 ? one : (many || one + 's')}`; },
    capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1).replace(/_/g, ' ') : ''; },
    /** Text excerpt for previews */
    excerpt(text, len = 140) {
      const t = String(text || '').replace(/\s+/g, ' ').trim();
      return t.length > len ? t.slice(0, len - 1) + '…' : t;
    }
  };

  UT.U = U;
})(globalThis.UT = globalThis.UT || {});
