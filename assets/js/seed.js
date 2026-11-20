/* UniTask — seed.js
 * Demo data so the prototype looks alive on first launch.
 * All dates are relative to "today", so the demo never goes stale.
 */
(function (UT) {
  'use strict';

  UT.seedDemo = function (DB) {
    const U = UT.U;
    const d = (n) => U.isoPlusDays(n);
    const ago = (days, hour = 18) => {
      const t = U.addDays(U.today(), -days);
      t.setHours(hour, 15, 0, 0);
      // never in the future (e.g. "today at 18:00" when it is still morning)
      return new Date(Math.min(t.getTime(), Date.now() - (days + 1) * 37 * 60000)).toISOString();
    };

    /* 1. Courses (parent table) — colours follow a fixed, colour-blind-checked order */
    const c = {};
    [
      ['web', { name: 'Web Development', code: 'CSE 214', teacher: 'Dr. A. Seitkali', color: '#2a78d6', credits: 6 }],
      ['db', { name: 'Database Systems', code: 'CSE 230', teacher: 'Prof. M. Ospanova', color: '#eb6834', credits: 5 }],
      ['calc', { name: 'Calculus II', code: 'MATH 152', teacher: 'Dr. B. Akhmetov', color: '#1baf7a', credits: 5 }],
      ['eng', { name: 'Academic English', code: 'ENG 110', teacher: 'Ms. L. Carter', color: '#eda100', credits: 3 }],
      ['algo', { name: 'Algorithms & Data Structures', code: 'CSE 220', teacher: 'Dr. N. Bekov', color: '#6250d6', credits: 6 }]
    ].forEach(([k, row]) => { c[k] = DB.insert('courses', row).id; });

    /* 2. Weekly timetable (each class → one course) */
    [
      [c.web, 1, '09:00', '10:30', 'lecture', 'Room 301'],
      [c.calc, 1, '11:00', '12:30', 'lecture', 'Main hall B'],
      [c.eng, 1, '14:00', '15:20', 'seminar', 'Room 112'],
      [c.db, 2, '09:00', '10:30', 'lecture', 'Room 205'],
      [c.algo, 2, '13:00', '14:30', 'lecture', 'Main hall A'],
      [c.web, 3, '10:00', '11:50', 'lab', 'Lab 4'],
      [c.calc, 3, '13:00', '14:20', 'practice', 'Room 214'],
      [c.db, 4, '11:00', '12:50', 'lab', 'Lab 2'],
      [c.algo, 4, '15:00', '16:30', 'practice', 'Room 318'],
      [c.eng, 5, '09:30', '10:50', 'seminar', 'Room 112'],
      [c.algo, 5, '11:00', '12:30', 'lab', 'Lab 4']
    ].forEach(([courseId, day, startTime, endTime, kind, location]) => {
      DB.insert('classes', { courseId, day, startTime, endTime, kind, location });
    });

    /* 3. Tasks (+ subtasks). completedAt is spread over the last two weeks for the Progress charts */
    const t = (row, subs) => {
      const task = DB.insert('tasks', row);
      (subs || []).forEach(([title, done], i) => DB.insert('subtasks', { taskId: task.id, title, done, position: i }));
      return task.id;
    };
    const tasks = {};
    tasks.landing = t({ courseId: c.web, title: 'Responsive landing page (Lab 5)', type: 'assignment', priority: 'high', status: 'in_progress', dueDate: d(2), dueTime: '23:59', estimatedHours: 6,
      description: 'Build a responsive landing page with Flexbox/Grid. Must pass the HTML validator and work on mobile.' },
    [['Wireframe in Figma', true], ['HTML structure', true], ['CSS grid layout', false], ['Mobile breakpoints', false], ['Deploy to GitHub Pages', false]]);
    tasks.erd = t({ courseId: c.db, title: 'ER diagram for library system', type: 'assignment', priority: 'high', status: 'todo', dueDate: d(1), dueTime: '18:00', estimatedHours: 3,
      description: 'Entities, relationships, cardinalities. Normalise to 3NF and submit as PDF.' },
    [['List entities & attributes', true], ['Draw relationships', false], ['Normalise to 3NF', false]]);
    t({ courseId: c.calc, title: 'Problem set 7: series & convergence', type: 'assignment', priority: 'medium', status: 'todo', dueDate: d(4), estimatedHours: 4 });
    t({ courseId: c.eng, title: 'Essay draft: "Technology in education"', type: 'assignment', priority: 'medium', status: 'todo', dueDate: d(6), dueTime: '12:00', estimatedHours: 3,
      description: '800–1000 words, APA citations, at least 4 academic sources.' });
    t({ courseId: c.algo, title: 'Midterm exam', type: 'exam', priority: 'high', status: 'todo', dueDate: d(9), dueTime: '10:00', estimatedHours: 10,
      description: 'Topics: sorting, binary search, recursion, Big-O, stacks/queues, hash tables.' },
    [['Review sorting algorithms', false], ['Solve past papers', false], ['Big-O cheat sheet', false]]);
    t({ courseId: c.db, title: 'SQL quiz 3 (JOINs)', type: 'exam', priority: 'medium', status: 'todo', dueDate: d(-1), dueTime: '09:00', estimatedHours: 1 });
    t({ courseId: c.algo, title: 'Implement a hash map', type: 'project', priority: 'medium', status: 'in_progress', dueDate: d(12), estimatedHours: 5 },
      [['Open addressing version', true], ['Unit tests', false]]);
    t({ courseId: c.eng, title: 'Read chapter 4: academic vocabulary', type: 'reading', priority: 'low', status: 'todo', dueDate: d(3), estimatedHours: 1 });
    t({ courseId: null, title: 'Renew library card', type: 'other', priority: 'low', status: 'todo', dueDate: d(5) });
    t({ courseId: c.web, title: 'Group project: proposal slides', type: 'project', priority: 'high', status: 'todo', dueDate: d(-2), estimatedHours: 2 });

    // completed work
    [
      [c.web, 'Lab 4: CSS Flexbox', 'assignment', 'medium', -12, 13],
      [c.calc, 'Problem set 6', 'assignment', 'medium', -9, 10],
      [c.db, 'Normalisation worksheet', 'assignment', 'low', -8, 10],
      [c.eng, 'Vocabulary test 2', 'exam', 'medium', -6, 8],
      [c.algo, 'Linked list lab', 'assignment', 'high', -5, 7],
      [c.web, 'JavaScript DOM quiz', 'exam', 'medium', -4, 4],
      [c.calc, 'Integration techniques summary', 'reading', 'low', -3, 4],
      [c.algo, 'Recursion exercises', 'assignment', 'medium', -4, 3],
      [c.db, 'Install PostgreSQL & run seed script', 'other', 'low', 0, 1],
      [c.algo, 'Stack & queue worksheet', 'assignment', 'medium', 0, 1],
      [c.eng, 'Peer review of essay outline', 'assignment', 'low', 1, 1],
      [c.web, 'Git & GitHub basics tutorial', 'reading', 'low', -1, 0]
    ].forEach(([courseId, title, type, priority, due, doneDaysAgo]) => {
      t({ courseId, title, type, priority, status: 'done', dueDate: d(due), completedAt: ago(doneDaysAgo, 15 + (doneDaysAgo % 5)) });
    });

    /* 4. Notes — some linked to a course, one linked to a task */
    [
      { courseId: c.db, taskId: tasks.erd, pinned: true, title: 'ER diagram checklist', tags: ['erd', 'exam'],
        content: '1. Every entity has a primary key.\n2. 1:N → foreign key on the "many" side.\n3. M:N → junction table with a composite key.\n4. No repeating groups (1NF), no partial dependencies (2NF), no transitive dependencies (3NF).' },
      { courseId: c.web, pinned: true, title: 'CSS Grid quick reference', tags: ['css', 'layout'],
        content: 'grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));\ngap: 16px;\nplace-items: center;\n\nUse Grid for 2-D layouts, Flexbox for 1-D rows/columns.' },
      { courseId: c.algo, title: 'Big-O of common operations', tags: ['exam', 'complexity'],
        content: 'Array access O(1)\nBinary search O(log n)\nMerge sort O(n log n)\nHash map get/put O(1) average, O(n) worst\nBFS / DFS O(V + E)' },
      { courseId: c.calc, title: 'Convergence tests', tags: ['series'],
        content: 'Divergence test → if lim aₙ ≠ 0 the series diverges.\nRatio test: L < 1 converges, L > 1 diverges, L = 1 inconclusive.\nIntegral test for positive decreasing functions.' },
      { courseId: c.eng, title: 'Essay structure', tags: ['writing'],
        content: 'Introduction (hook + thesis)\n3 body paragraphs: topic sentence → evidence → analysis\nConclusion: restate thesis, no new ideas.' },
      { courseId: null, title: 'Semester goals', tags: ['personal'],
        content: 'GPA ≥ 3.5\nSubmit every assignment at least one day early\nGo to the gym 3× per week' }
    ].forEach((n, i) => DB.insert('notes', Object.assign({ createdAt: ago(i * 2 + 1, 20), updatedAt: ago(i, 20 - i) }, n)));

    /* 5. A bit of history for the "Recent activity" feed */
    DB.all('tasks', { where: (x) => x.status === 'done' }).forEach((x) => {
      DB.insert('activity', { entity: 'tasks', entityId: x.id, action: 'completed', label: x.title, createdAt: x.completedAt });
    });
    DB.all('notes').slice(0, 2).forEach((n, i) => {
      DB.insert('activity', { entity: 'notes', entityId: n.id, action: 'created', label: n.title, createdAt: ago(i + 1, 21) });
    });

    DB.saveSettings({ userName: 'Student', university: '' });
  };
})(globalThis.UT = globalThis.UT || {});
