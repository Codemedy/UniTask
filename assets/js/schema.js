/* UniTask — schema.js
 * Declarative description of the browser "database".
 *
 * LocalStorage itself is only a key → string store. UniTask builds a small
 * relational layer on top of it: every table below is stored under its own key
 * as a JSON array, and the DB layer (db.js) enforces the rules declared here:
 *   - primary keys (string ids with a table prefix)
 *   - column types, required fields, enums, length / range limits
 *   - foreign keys (`ref`) with ON DELETE behaviour: CASCADE | SET NULL | RESTRICT
 *
 * The same schema is documented as SQL in docs/schema.sql and as an
 * ER diagram in docs/DATABASE.md.
 */
(function (UT) {
  'use strict';

  const ts = { type: 'datetime' };

  UT.SCHEMA = {
    version: 1,
    storagePrefix: 'unitask.v1.',

    tables: {
      /* Subjects the student is enrolled in — the hub that links everything together */
      courses: {
        label: 'Courses',
        idPrefix: 'crs',
        fields: {
          id:        { type: 'id' },
          name:      { type: 'string', required: true, max: 80 },
          code:      { type: 'string', max: 20 },
          teacher:   { type: 'string', max: 80 },
          color:     { type: 'color', required: true, default: '#2a78d6' },
          credits:   { type: 'int', min: 0, max: 30, default: 5 },
          createdAt: ts,
          updatedAt: ts
        }
      },

      /* Assignments, exams, projects … */
      tasks: {
        label: 'Tasks',
        idPrefix: 'tsk',
        fields: {
          id:          { type: 'id' },
          courseId:    { type: 'ref', ref: 'courses', onDelete: 'SET NULL' },
          title:       { type: 'string', required: true, max: 120 },
          description: { type: 'string', max: 2000 },
          type:        { type: 'enum', values: ['assignment', 'exam', 'project', 'reading', 'other'], default: 'assignment' },
          priority:    { type: 'enum', values: ['low', 'medium', 'high'], default: 'medium' },
          status:      { type: 'enum', values: ['todo', 'in_progress', 'done'], default: 'todo' },
          dueDate:     { type: 'date' },
          dueTime:     { type: 'time' },
          estimatedHours: { type: 'number', min: 0, max: 500 },
          completedAt: ts,
          createdAt:   ts,
          updatedAt:   ts
        }
      },

      /* Checklist items inside a task (1 task → N subtasks) */
      subtasks: {
        label: 'Subtasks',
        idPrefix: 'sub',
        fields: {
          id:        { type: 'id' },
          taskId:    { type: 'ref', ref: 'tasks', required: true, onDelete: 'CASCADE' },
          title:     { type: 'string', required: true, max: 120 },
          done:      { type: 'bool', default: false },
          position:  { type: 'int', min: 0, default: 0 },
          createdAt: ts,
          updatedAt: ts
        }
      },

      /* Weekly timetable — a class always belongs to a course */
      classes: {
        label: 'Schedule (classes)',
        idPrefix: 'cls',
        fields: {
          id:        { type: 'id' },
          courseId:  { type: 'ref', ref: 'courses', required: true, onDelete: 'CASCADE' },
          day:       { type: 'int', required: true, min: 1, max: 7 }, // 1 = Monday … 7 = Sunday
          startTime: { type: 'time', required: true },
          endTime:   { type: 'time', required: true },
          kind:      { type: 'enum', values: ['lecture', 'practice', 'lab', 'seminar'], default: 'lecture' },
          location:  { type: 'string', max: 60 },
          createdAt: ts,
          updatedAt: ts
        },
        /* table-level CHECK constraint */
        check(row) {
          if (row.startTime && row.endTime && row.endTime <= row.startTime) {
            return { endTime: 'End time must be after start time' };
          }
          return null;
        }
      },

      /* Study notes — may be attached to a course and/or a specific task */
      notes: {
        label: 'Notes',
        idPrefix: 'nte',
        fields: {
          id:        { type: 'id' },
          courseId:  { type: 'ref', ref: 'courses', onDelete: 'SET NULL' },
          taskId:    { type: 'ref', ref: 'tasks', onDelete: 'SET NULL' },
          title:     { type: 'string', required: true, max: 120 },
          content:   { type: 'string', max: 20000 },
          tags:      { type: 'tags', default: [] },
          pinned:    { type: 'bool', default: false },
          createdAt: ts,
          updatedAt: ts
        }
      },

      /* Audit log written automatically by the DB layer (feeds "Recent activity").
       * entityId is a polymorphic reference: no FK, the row survives deletion. */
      activity: {
        label: 'Activity log',
        idPrefix: 'act',
        system: true,
        maxRows: 200,
        fields: {
          id:       { type: 'id' },
          entity:   { type: 'enum', values: ['courses', 'tasks', 'subtasks', 'classes', 'notes'], required: true },
          entityId: { type: 'string', required: true },
          action:   { type: 'enum', values: ['created', 'updated', 'completed', 'reopened', 'deleted'], required: true },
          label:    { type: 'string', max: 140 },
          createdAt: ts
        }
      }
    },

    /* Key/value singleton (one row) */
    settings: {
      key: 'settings',
      defaults: {
        userName: 'Student',
        university: '',
        theme: 'system',           // light | dark | system
        weekStartsOn: 1,           // 1 = Monday
        showWeekend: false,
        dayStart: '08:00',
        dayEnd: '19:00',
        upcomingDays: 7,           // dashboard horizon
        confirmDelete: true
      }
    }
  };

  /** Fields in other tables that point to `table` (used for cascades & docs). */
  UT.SCHEMA.referencesTo = function (table) {
    const out = [];
    Object.entries(UT.SCHEMA.tables).forEach(([name, def]) => {
      Object.entries(def.fields).forEach(([field, f]) => {
        if (f.type === 'ref' && f.ref === table) out.push({ table: name, field, onDelete: f.onDelete || 'RESTRICT' });
      });
    });
    return out;
  };
})(globalThis.UT = globalThis.UT || {});
