-- UniTask — SQL equivalent of the browser schema (assets/js/schema.js)
-- Dialect: PostgreSQL 15+. This file documents the data model and is the
-- starting point for a future server version (v2: accounts + cloud sync).
-- The prototype itself stores the same tables as JSON arrays in LocalStorage.

CREATE TYPE task_type     AS ENUM ('assignment', 'exam', 'project', 'reading', 'other');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE task_status   AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE class_kind    AS ENUM ('lecture', 'practice', 'lab', 'seminar');
CREATE TYPE activity_action AS ENUM ('created', 'updated', 'completed', 'reopened', 'deleted');

-- Parent table: every other entity hangs off a course
CREATE TABLE courses (
    id          VARCHAR(32)  PRIMARY KEY,                 -- 'crs_…'
    name        VARCHAR(80)  NOT NULL,
    code        VARCHAR(20),
    teacher     VARCHAR(80),
    color       CHAR(7)      NOT NULL DEFAULT '#2a78d6' CHECK (color ~ '^#[0-9a-f]{6}$'),
    credits     SMALLINT     DEFAULT 5 CHECK (credits BETWEEN 0 AND 30),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
    id              VARCHAR(32)   PRIMARY KEY,            -- 'tsk_…'
    course_id       VARCHAR(32)   REFERENCES courses(id) ON DELETE SET NULL,
    title           VARCHAR(120)  NOT NULL,
    description     VARCHAR(2000),
    type            task_type     NOT NULL DEFAULT 'assignment',
    priority        task_priority NOT NULL DEFAULT 'medium',
    status          task_status   NOT NULL DEFAULT 'todo',
    due_date        DATE,
    due_time        TIME,
    estimated_hours NUMERIC(5,1)  CHECK (estimated_hours BETWEEN 0 AND 500),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    -- completed_at is filled exactly when the task is done
    CONSTRAINT completed_matches_status CHECK ((status = 'done') = (completed_at IS NOT NULL))
);
CREATE INDEX idx_tasks_course ON tasks(course_id);
CREATE INDEX idx_tasks_due    ON tasks(status, due_date);

CREATE TABLE subtasks (
    id          VARCHAR(32)  PRIMARY KEY,                 -- 'sub_…'
    task_id     VARCHAR(32)  NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title       VARCHAR(120) NOT NULL,
    done        BOOLEAN      NOT NULL DEFAULT FALSE,
    position    SMALLINT     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_subtasks_task ON subtasks(task_id, position);

CREATE TABLE classes (
    id          VARCHAR(32)  PRIMARY KEY,                 -- 'cls_…'
    course_id   VARCHAR(32)  NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    day         SMALLINT     NOT NULL CHECK (day BETWEEN 1 AND 7),   -- 1 = Monday
    start_time  TIME         NOT NULL,
    end_time    TIME         NOT NULL,
    kind        class_kind   NOT NULL DEFAULT 'lecture',
    location    VARCHAR(60),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT end_after_start CHECK (end_time > start_time)
);
CREATE INDEX idx_classes_day ON classes(day, start_time);

CREATE TABLE notes (
    id          VARCHAR(32)   PRIMARY KEY,                -- 'nte_…'
    course_id   VARCHAR(32)   REFERENCES courses(id) ON DELETE SET NULL,
    task_id     VARCHAR(32)   REFERENCES tasks(id)   ON DELETE SET NULL,
    title       VARCHAR(120)  NOT NULL,
    content     VARCHAR(20000),
    tags        TEXT[]        NOT NULL DEFAULT '{}',      -- see note_tags below for a normalised variant
    pinned      BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_course ON notes(course_id);

-- Audit log: polymorphic reference (entity + entity_id), intentionally without FK
CREATE TABLE activity (
    id          VARCHAR(32)     PRIMARY KEY,              -- 'act_…'
    entity      VARCHAR(16)     NOT NULL CHECK (entity IN ('courses', 'tasks', 'subtasks', 'classes', 'notes')),
    entity_id   VARCHAR(32)     NOT NULL,
    action      activity_action NOT NULL,
    label       VARCHAR(140),
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_time ON activity(created_at DESC);

-- Singleton settings row
CREATE TABLE settings (
    id             SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    user_name      VARCHAR(40) NOT NULL DEFAULT 'Student',
    university     VARCHAR(80),
    theme          VARCHAR(6)  NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    week_starts_on SMALLINT    NOT NULL DEFAULT 1,
    show_weekend   BOOLEAN     NOT NULL DEFAULT FALSE,
    day_start      TIME        NOT NULL DEFAULT '08:00',
    day_end        TIME        NOT NULL DEFAULT '19:00',
    upcoming_days  SMALLINT    NOT NULL DEFAULT 7 CHECK (upcoming_days BETWEEN 1 AND 60),
    confirm_delete BOOLEAN     NOT NULL DEFAULT TRUE
);

/* ---------------------------------------------------------------------------
 * v2 (outside the initial scope): accounts + normalised tags
 * ---------------------------------------------------------------------------
 * CREATE TABLE users (id UUID PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
 * ALTER TABLE courses ADD COLUMN user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE;   -- same for tasks, notes, …
 * CREATE TABLE tags (id SERIAL PRIMARY KEY, name VARCHAR(40) UNIQUE NOT NULL);
 * CREATE TABLE note_tags (note_id VARCHAR(32) REFERENCES notes(id) ON DELETE CASCADE,
 *                         tag_id INT REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (note_id, tag_id));   -- M:N
 */

-- Example queries used by the UI ------------------------------------------------

-- Dashboard: upcoming deadlines (next 7 days + overdue) with course name
SELECT t.title, c.name AS course, t.due_date, t.priority
FROM tasks t LEFT JOIN courses c ON c.id = t.course_id
WHERE t.status <> 'done' AND t.due_date <= CURRENT_DATE + 7
ORDER BY t.due_date, t.due_time NULLS LAST;

-- Progress: completion rate per course
SELECT COALESCE(c.name, 'No course') AS course,
       COUNT(*) FILTER (WHERE t.status = 'done') AS done,
       COUNT(*) AS total,
       ROUND(100.0 * COUNT(*) FILTER (WHERE t.status = 'done') / COUNT(*)) AS pct
FROM tasks t LEFT JOIN courses c ON c.id = t.course_id
GROUP BY c.name ORDER BY c.name;

-- Progress: tasks completed per day, last 14 days
SELECT completed_at::date AS day, COUNT(*) FROM tasks
WHERE completed_at >= CURRENT_DATE - 13 GROUP BY 1 ORDER BY 1;

-- Schedule: weekly hours per course
SELECT c.name, SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) AS hours_per_week
FROM classes cl JOIN courses c ON c.id = cl.course_id GROUP BY c.name ORDER BY 2 DESC;
