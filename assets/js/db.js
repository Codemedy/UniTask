/* UniTask — db.js
 * A tiny relational data layer over window.localStorage.
 *
 *   UI page ──calls──▶ DB.insert / update / remove / all / get
 *                         │  1. normalize + validate against SCHEMA
 *                         │  2. check foreign keys exist
 *                         │  3. apply ON DELETE rules (CASCADE / SET NULL)
 *                         │  4. write JSON to localStorage ("unitask.v1.<table>")
 *                         │  5. append a row to the activity log
 *                         ▼  6. emit a change event → the current page re-renders
 *
 * Reads are served from an in-memory cache that is loaded once at start-up,
 * so the UI never parses JSON on every render.
 */
(function (UT) {
  'use strict';

  const S = UT.SCHEMA;
  const U = UT.U;
  const KEY = (name) => S.storagePrefix + name;
  /* Parent tables first: the order used for import and for docs */
  const TABLE_ORDER = ['courses', 'tasks', 'subtasks', 'classes', 'notes', 'activity'];

  /* ---------- storage driver: localStorage, or memory if it is blocked ---------- */
  const memory = new Map();
  let ls = null;
  try {
    ls = globalThis.localStorage;
    ls.setItem('__unitask_probe', '1');
    ls.removeItem('__unitask_probe');
  } catch (e) {
    ls = null; // private mode / sandbox: keep working, just without persistence
  }
  const store = {
    persistent: !!ls,
    get: (k) => (ls ? ls.getItem(k) : (memory.has(k) ? memory.get(k) : null)),
    set: (k, v) => {
      if (!ls) { memory.set(k, v); return; }
      try { ls.setItem(k, v); } catch (e) {
        throw new Error('Browser storage is full. Export a backup and delete old items.');
      }
    },
    remove: (k) => (ls ? ls.removeItem(k) : memory.delete(k)),
    keys: () => (ls ? Object.keys(ls) : [...memory.keys()]).filter((k) => k.startsWith(S.storagePrefix))
  };

  /* ---------- errors ---------- */
  class ValidationError extends Error {
    constructor(errors) {
      super(Object.values(errors)[0] || 'Invalid data');
      this.name = 'ValidationError';
      this.errors = errors; // { field: message }
    }
  }

  /* ---------- state ---------- */
  const cache = { tables: {}, settings: null, meta: null };
  const listeners = new Set();
  let silent = 0; // >0 while seeding/importing: no activity rows, no events

  function readJSON(key, fallback) {
    try {
      const raw = store.get(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('[UniTask] corrupted value in', key, e);
      return fallback;
    }
  }
  function persist(table) { store.set(KEY(table), JSON.stringify(cache.tables[table])); }
  function persistAll() {
    TABLE_ORDER.forEach(persist);
    store.set(KEY(S.settings.key), JSON.stringify(cache.settings));
    store.set(KEY('meta'), JSON.stringify(cache.meta));
  }
  function emit(evt) {
    if (silent) return;
    listeners.forEach((fn) => { try { fn(evt); } catch (e) { console.error(e); } });
  }
  function def(table) {
    const d = S.tables[table];
    if (!d) throw new Error(`Unknown table "${table}"`);
    return d;
  }
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* ---------- validation & normalisation ---------- */
  const RX = {
    date: /^\d{4}-\d{2}-\d{2}$/,
    time: /^([01]\d|2[0-3]):[0-5]\d$/,
    color: /^#[0-9a-fA-F]{6}$/
  };
  const isEmpty = (v) => v === undefined || v === null || v === '';

  /** Build a clean row from raw input. Unknown keys are dropped. Throws ValidationError. */
  function normalize(table, input, existing) {
    const d = def(table);
    const row = {};
    const errors = {};

    Object.entries(d.fields).forEach(([name, f]) => {
      if (f.type === 'id') return;
      let v = Object.prototype.hasOwnProperty.call(input, name) ? input[name]
        : existing ? existing[name]
        : (f.default !== undefined ? clone(f.default) : undefined);

      if (f.type === 'string' && typeof v === 'string') v = v.trim();
      if (isEmpty(v)) {
        if (f.required) errors[name] = `${U.capitalize(name)} is required`;
        row[name] = f.type === 'string' ? '' : f.type === 'tags' ? [] : f.type === 'bool' ? false : null;
        return;
      }

      switch (f.type) {
        case 'string':
          v = String(v);
          if (f.max && v.length > f.max) errors[name] = `${U.capitalize(name)} must be at most ${f.max} characters`;
          break;
        case 'int':
        case 'number':
          v = Number(v);
          if (!Number.isFinite(v) || (f.type === 'int' && !Number.isInteger(v))) errors[name] = `${U.capitalize(name)} must be a ${f.type === 'int' ? 'whole ' : ''}number`;
          else if (f.min !== undefined && v < f.min) errors[name] = `${U.capitalize(name)} must be ≥ ${f.min}`;
          else if (f.max !== undefined && v > f.max) errors[name] = `${U.capitalize(name)} must be ≤ ${f.max}`;
          break;
        case 'bool':
          v = v === true || v === 'true' || v === 'on' || v === 1 || v === '1';
          break;
        case 'enum':
          if (!f.values.includes(v)) errors[name] = `${U.capitalize(name)} must be one of: ${f.values.join(', ')}`;
          break;
        case 'date':
        case 'time':
        case 'color':
          v = String(v);
          if (!RX[f.type].test(v)) errors[name] = `${U.capitalize(name)} has an invalid ${f.type} format`;
          if (f.type === 'color') v = v.toLowerCase();
          break;
        case 'datetime':
          if (Number.isNaN(new Date(v).getTime())) errors[name] = `${U.capitalize(name)} is not a valid timestamp`;
          else v = new Date(v).toISOString();
          break;
        case 'tags': {
          const list = Array.isArray(v) ? v : String(v).split(',');
          v = [...new Set(list.map((t) => String(t).trim().toLowerCase().replace(/^#/, '')).filter(Boolean))].slice(0, 12);
          break;
        }
        case 'ref':
          v = String(v);
          if (!cache.tables[f.ref].some((r) => r.id === v)) {
            errors[name] = `Linked ${f.ref.replace(/s$/, '')} does not exist (foreign key ${table}.${name} → ${f.ref}.id)`;
          }
          break;
        default:
          break;
      }
      row[name] = v;
    });

    if (d.check) Object.assign(errors, d.check(row) || {});
    if (Object.keys(errors).length) throw new ValidationError(errors);
    return row;
  }

  /* ---------- activity log ---------- */
  function labelOf(table, row) {
    if (table === 'classes') {
      const c = cache.tables.courses.find((x) => x.id === row.courseId);
      return `${c ? c.name : 'Class'} · ${U.DAY_SHORT[row.day - 1]} ${row.startTime}`;
    }
    return row.title || row.name || row.id;
  }
  function log(table, row, action) {
    if (silent || table === 'activity' || table === 'subtasks') return;
    const t = cache.tables.activity;
    t.unshift({
      id: U.uid(def('activity').idPrefix),
      entity: table, entityId: row.id, action,
      label: U.excerpt(labelOf(table, row), 140),
      createdAt: new Date().toISOString()
    });
    if (t.length > def('activity').maxRows) t.length = def('activity').maxRows;
    persist('activity');
  }

  /* ---------- delete planning (referential integrity) ---------- */
  /** Walks foreign keys and returns what a delete would do, without changing anything. */
  function planDelete(table, id, plan = { delete: [], setNull: [] }) {
    if (plan.delete.some((p) => p.table === table && p.id === id)) return plan;
    plan.delete.push({ table, id });
    S.referencesTo(table).forEach((ref) => {
      cache.tables[ref.table].filter((r) => r[ref.field] === id).forEach((child) => {
        if (ref.onDelete === 'CASCADE') planDelete(ref.table, child.id, plan);
        else if (ref.onDelete === 'SET NULL') plan.setNull.push({ table: ref.table, id: child.id, field: ref.field });
        else throw new Error(`Cannot delete: ${ref.table} still reference this ${table.replace(/s$/, '')}`);
      });
    });
    return plan;
  }
  function summarizePlan(plan) {
    const count = (list) => list.reduce((acc, p) => { acc[p.table] = (acc[p.table] || 0) + 1; return acc; }, {});
    const del = count(plan.delete.slice(1));
    const nul = count(plan.setNull.filter((p) => !plan.delete.some((d) => d.table === p.table && d.id === p.id)));
    return { cascade: del, unlink: nul };
  }

  /* ---------- public API ---------- */
  const DB = {
    ValidationError,
    TABLE_ORDER,
    get persistent() { return store.persistent; },

    /** Load everything from storage. Seeds demo data on the very first run. */
    init(options = {}) {
      cache.meta = readJSON(KEY('meta'), null);
      TABLE_ORDER.forEach((t) => {
        const rows = readJSON(KEY(t), []);
        cache.tables[t] = Array.isArray(rows) ? rows : [];
      });
      cache.settings = Object.assign({}, S.settings.defaults, readJSON(KEY(S.settings.key), {}));

      const firstRun = !cache.meta;
      if (firstRun) {
        cache.meta = { schemaVersion: S.version, createdAt: new Date().toISOString() };
        if (options.seed !== false && UT.seedDemo) DB.withoutEvents(() => UT.seedDemo(DB));
        persistAll();
      } else if (cache.meta.schemaVersion < S.version) {
        DB.migrate(cache.meta.schemaVersion);
      }
      return { firstRun };
    },

    /** Placeholder for future schema upgrades (v1 → v2 …). */
    migrate(fromVersion) {
      // Example: if (fromVersion < 2) cache.tables.tasks.forEach(t => { t.newField = null; });
      cache.meta.schemaVersion = S.version;
      cache.meta.migratedFrom = fromVersion;
      persistAll();
    },

    withoutEvents(fn) {
      silent++;
      try { return fn(); } finally { silent--; }
    },

    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    /* --- read --- */
    all(table, { where, sort } = {}) {
      let rows = def(table) && cache.tables[table].slice();
      if (where) rows = rows.filter(where);
      if (sort) rows.sort(sort);
      return rows;
    },
    get(table, id) {
      if (!id) return null;
      return cache.tables[table].find((r) => r.id === id) || null;
    },
    count(table, where) { return where ? cache.tables[table].filter(where).length : cache.tables[table].length; },
    /** id → row map for fast "joins" while rendering lists */
    index(table) {
      const m = new Map();
      cache.tables[table].forEach((r) => m.set(r.id, r));
      return m;
    },

    /* --- write --- */
    insert(table, data, opts = {}) {
      const row = normalize(table, data, null);
      const now = new Date().toISOString();
      const id = opts.keepId && data.id ? String(data.id) : U.uid(def(table).idPrefix);
      if (cache.tables[table].some((r) => r.id === id)) throw new ValidationError({ id: `Duplicate primary key ${id}` });
      const full = Object.assign({ id }, row, {
        createdAt: row.createdAt || now,
        updatedAt: row.updatedAt || row.createdAt || now
      });
      if (table === 'tasks') full.completedAt = full.status === 'done' ? (row.completedAt || now) : null;
      cache.tables[table].push(full);
      persist(table);
      log(table, full, 'created');
      emit({ table, action: 'insert', id });
      return clone(full);
    },

    update(table, id, patch) {
      const list = cache.tables[table];
      const i = list.findIndex((r) => r.id === id);
      if (i < 0) throw new Error(`${table}: row ${id} not found`);
      const before = list[i];
      const row = normalize(table, patch, before);
      const after = Object.assign({}, before, row, { id, createdAt: before.createdAt, updatedAt: new Date().toISOString() });

      let action = 'updated';
      if (table === 'tasks' && before.status !== after.status) {
        if (after.status === 'done') { after.completedAt = patch.completedAt || new Date().toISOString(); action = 'completed'; }
        else if (before.status === 'done') { after.completedAt = null; action = 'reopened'; }
      }
      list[i] = after;
      persist(table);
      log(table, after, action);
      emit({ table, action: 'update', id });
      return clone(after);
    },

    /** Describe the side effects of deleting a row (for confirmation dialogs). */
    previewDelete(table, id) { return summarizePlan(planDelete(table, id)); },

    /** Delete a row and apply ON DELETE rules to dependent rows. */
    remove(table, id) {
      const target = DB.get(table, id);
      if (!target) return null;
      const plan = planDelete(table, id);
      const touched = new Set();
      plan.setNull.forEach((p) => {
        const r = cache.tables[p.table].find((x) => x.id === p.id);
        if (r) { r[p.field] = null; r.updatedAt = new Date().toISOString(); touched.add(p.table); }
      });
      plan.delete.forEach((p) => {
        cache.tables[p.table] = cache.tables[p.table].filter((r) => r.id !== p.id);
        touched.add(p.table);
      });
      touched.forEach(persist);
      log(table, target, 'deleted');
      emit({ table, action: 'delete', id });
      return summarizePlan(plan);
    },

    /* --- settings (singleton row) --- */
    settings() { return Object.assign({}, cache.settings); },
    saveSettings(patch) {
      cache.settings = Object.assign({}, cache.settings, patch);
      store.set(KEY(S.settings.key), JSON.stringify(cache.settings));
      emit({ table: 'settings', action: 'update' });
      return DB.settings();
    },

    /* --- maintenance --- */
    /** Finds rows whose foreign keys point to rows that no longer exist. */
    integrityCheck() {
      const problems = [];
      Object.entries(S.tables).forEach(([table, d]) => {
        Object.entries(d.fields).filter(([, f]) => f.type === 'ref').forEach(([field, f]) => {
          const ids = new Set(cache.tables[f.ref].map((r) => r.id));
          cache.tables[table].forEach((r) => {
            if (r[field] && !ids.has(r[field])) problems.push({ table, id: r.id, field, missing: r[field] });
          });
        });
      });
      return problems;
    },

    storageInfo() {
      const tables = TABLE_ORDER.map((t) => ({
        table: t,
        label: def(t).label,
        key: KEY(t),
        rows: cache.tables[t].length,
        bytes: (store.get(KEY(t)) || '').length * 2 // UTF-16
      }));
      const total = store.keys().reduce((sum, k) => sum + ((store.get(k) || '').length + k.length) * 2, 0);
      return { tables, totalBytes: total, persistent: store.persistent, meta: Object.assign({}, cache.meta) };
    },

    exportData() {
      const tables = {};
      TABLE_ORDER.forEach((t) => { tables[t] = clone(cache.tables[t]); });
      return {
        app: 'UniTask',
        schemaVersion: S.version,
        exportedAt: new Date().toISOString(),
        settings: DB.settings(),
        tables
      };
    },

    /** Replace all data with a backup. All-or-nothing: on any error nothing changes. */
    importData(data) {
      if (!data || data.app !== 'UniTask' || typeof data.tables !== 'object') {
        throw new Error('This file is not a UniTask backup');
      }
      const snapshot = clone({ tables: cache.tables, settings: cache.settings });
      try {
        DB.withoutEvents(() => {
          TABLE_ORDER.forEach((t) => { cache.tables[t] = []; });
          TABLE_ORDER.forEach((t) => {
            (data.tables[t] || []).forEach((row) => {
              const created = DB.insert(t, row, { keepId: true });
              if (t === 'tasks' && row.completedAt) {
                cache.tables.tasks.find((r) => r.id === created.id).completedAt = row.completedAt;
              }
            });
          });
          cache.settings = Object.assign({}, S.settings.defaults, data.settings || {});
        });
      } catch (e) {
        cache.tables = snapshot.tables;
        cache.settings = snapshot.settings;
        throw e;
      }
      persistAll();
      emit({ table: '*', action: 'import' });
    },

    /** Wipe everything. withDemo = true re-creates the sample data. */
    reset({ withDemo = true } = {}) {
      store.keys().forEach((k) => store.remove(k));
      TABLE_ORDER.forEach((t) => { cache.tables[t] = []; });
      const keepTheme = cache.settings && cache.settings.theme;
      cache.settings = Object.assign({}, S.settings.defaults, keepTheme ? { theme: keepTheme } : {});
      cache.meta = { schemaVersion: S.version, createdAt: new Date().toISOString() };
      if (withDemo && UT.seedDemo) DB.withoutEvents(() => UT.seedDemo(DB));
      persistAll();
      emit({ table: '*', action: 'reset' });
    }
  };

  UT.DB = DB;
})(globalThis.UT = globalThis.UT || {});
