# UniTask: presentation speech

> Текст речи для защиты. Английский уровня B1, около 13–15 минут вместе с демо.
> Порядок: **Arslan → Ruslan → Arsen → Amirkhan (+ live demo) → Arslan**.
> В [квадратных скобках] указаны действия на сцене. **Жирным** выделены слова, которые стоит произнести с ударением.

| Order | Speaker | Topic | Slides | Time |
|---|---|---|---|---|
| 1 | Arslan | Opening: hook, problem, what UniTask is, the team | 1–2 | ~1.5 min |
| 2 | Ruslan | Research question, methodology, competitors | 3–5 | ~2.5 min |
| 3 | Arsen | Design, Schedule, Notes, Progress | 6–7, 13 | ~3 min |
| 4 | Amirkhan | Dashboard & Tasks, technologies, database, live demo | 8–12 | ~5 min |
| 5 | Arslan | Results, limitations, next steps, questions | 14–15 | ~1.5 min |

---

## 1. Arslan: opening

[Slide 1, title. Smile, look at the audience, wait two seconds before you start.]

Good morning, everyone! My name is Arslan, and today our team is **really excited** to show you our project: **UniTask, a student productivity platform.**

Let me start with a small question. Please raise your hand if you have ever **missed a deadline** because it was lost somewhere in a group chat.

[Pause. Raise your own hand.]

Yes, I can see a lot of hands. Mine too!

[Slide 2, problem.]

As students, we use **too many apps** every day. Our deadlines are in group chats. Our class schedule is a screenshot somewhere in the phone gallery. Our notes are in a notebook, or in Google Docs, or… nobody knows where. And our to-do list usually lives only in our head.

So it is very easy to forget something important. And it is really hard to answer a simple question: **"What do I need to do this week?"**

So we asked ourselves: **what if everything a student needs is in one place?** That is how UniTask was born.

UniTask is a web application. It brings together **tasks and deadlines, the weekly class schedule, study notes, and progress statistics**, all in one clean and simple interface.

We are a team of four. **Ruslan** did the research and kept us organized. **Arsen** designed the interface. **Amirkhan** built the application and the data storage. And I am here to guide you through our story.

So, how did we study the problem? Ruslan, over to you!

---

## 2. Ruslan: research and competitors

[Slide 3, research question.]

Thank you, Arslan! Hello, everyone. I was responsible for **research and project coordination**.

Every good project starts with a good question. Our research question is:

> **"How can a web-based productivity platform help university students organize academic tasks and manage their study time more effectively?"**

To answer it, we set five goals. First, find the real problems students have with deadlines. Second, look at existing tools. Third, design and build a clear, responsive prototype. Fourth, save tasks, schedule and notes in the browser. And fifth, collect feedback from real students.

[Slide 4, methodology.]

We chose a **user-centred approach** in six steps. One: a short **Google Forms survey** for about thirty to fifty students. Two: a **competitor review**. Three: **design in Figma**. Four: **building the prototype**. Five: **user testing** with our classmates. And six: an **evaluation** with numbers, percentages and charts.

To be honest, our first ideas are still **assumptions**. We expect that students want a simple dashboard, clear priorities and a quick view of upcoming work. The survey and the testing will show if we are right.

[Slide 5, comparison table.]

Now, the competitors. We looked at three popular tools.

**Notion** is very powerful, but for many students it is **too complicated**. You have to build everything yourself.

**Todoist** is great for tasks, but it has **no class schedule** and **no notes**.

**Google Calendar** is perfect for time, but you **cannot track** your assignments or keep notes there.

So every tool solves **only one piece** of the puzzle. UniTask connects all the pieces. A course is automatically linked to its tasks, its classes and its notes. And there is **no registration**: you just open it and start.

Okay, but a good idea also needs a good design. Arsen, show them!

---

## 3. Arsen: design, schedule, notes, progress

[Slide 6, design: light, dark and mobile screenshots.]

Thanks, Ruslan! Hi, everyone. My part was **UI/UX design** and the interface.

We started in **Figma**. Our main rule was simple: **a student should understand the app in five seconds.**

So we made a clear menu with seven sections on the left. And we gave every course **its own color**. For example, Web Development is blue and Database Systems is orange. You see this color everywhere: in tasks, in the schedule, in notes. So your brain finds things **faster**.

We also have a **light mode and a dark mode**, because… well, a lot of students study at night!

And of course, UniTask is **responsive**. It works on a laptop, a tablet and a phone. On a phone, the menu slides in from the side, and the forms open from the bottom, like in a mobile app.

[Slide 7, Schedule and Notes.]

Now, two sections I built myself.

First, the **Schedule**. Here you see your whole week as a grid. Do you want to add a class? Just **click on an empty cell**, choose the course, the room and the time, and it is done. A **red line** shows the current time. And my favorite feature: if you try to put two classes at the same time, UniTask **warns you**: "This overlaps with Web Development." No more double booking!

Second, **Notes**. You can write lecture notes, add tags like **#exam**, and search. The search **highlights** the words you are looking for. You can also **pin** important notes with a star, and they appear on the main page. And a note can be linked to a course or even to a specific task.

[Slide 13, Progress.]

And one more thing: the **Progress** page. It shows your completion rate, how many tasks you finished **on time**, a chart for the last fourteen days, and your progress in every course. Honestly, it is **very motivating** to see these bars grow!

But how does all this work inside? Amirkhan, the floor is yours!

---

## 4. Amirkhan: development, database, live demo

[Slide 8, Dashboard and Tasks.]

Thank you, Arsen! Hello, everyone. I was responsible for **frontend development**: the Dashboard, the Tasks section, and the way we **store data**.

The **Dashboard** is the first thing you see in the morning. It shows how many tasks are open, what is due this week, what is **overdue**, today's classes, and your progress.

In **Tasks**, you can add, edit, delete and complete assignments. Every task has a **priority**, a **deadline**, and even **subtasks**, like a small checklist. You can filter tasks by course or priority, or quickly open "Due today" or "Overdue".

[Slide 9, technologies.]

Now, the technologies. We used only **HTML, CSS and JavaScript**: no frameworks, no libraries. That means the app opens with **one double click**, it is very fast, and it **works offline**.

[Slide 11, database / ER diagram.]

Now, my favorite part: **the database**.

Our data lives in **LocalStorage**. You can imagine it as a **small notebook inside your browser**. But there is a problem: this notebook can only save simple text, just a name and a value. It does not know anything about tables or relations.

So we built **our own small database layer** on top of it. We have **six tables**: courses, tasks, subtasks, classes, notes and an activity log. They are connected with **IDs**, just like in a real relational database.

[Point to the diagram.]

The **course** is in the center. One course has many tasks, many classes and many notes. One task has many subtasks.

And our database has **rules**, like a real one. You **cannot** save a task without a title. A class **cannot** end before it starts. And a task **cannot** point to a course that does not exist.

The coolest rule is about **deleting**. When you delete a course, its classes are deleted too, because a class without a course makes no sense. This is called **cascade delete**. But your tasks and notes are **not deleted**. They just lose the link to the course, because we never want to destroy a student's work. And before anything happens, the app **shows you a warning** with all the details.

[Slide 10, architecture.]

There is one more important idea. The pages **never** talk to the storage directly. They always go through our database layer. So in the future we can replace LocalStorage with a real server, and the interface **stays the same**. We even wrote the same schema in **SQL for PostgreSQL**, and we tested it.

And we have **nine automatic tests** for the database, and **all of them pass**.

[Slide 12, live demo. Switch to the browser.]

Okay, enough talking. **Let me show you!**

[Dashboard] This is the Dashboard. You can see two overdue tasks in red and today's classes. Let me complete this task… **click**, and look: the counters and the progress ring update **immediately**.

[Tasks → New task] Now I'll add a new task: "Lab 6: JavaScript events", Web Development, high priority, and two subtasks. **Create.** Here it is!

[Click Save on an empty form.] And if I forget the title? The app stops me: "Title is required."

[Schedule] In the schedule, let me add a class at the same time as another one… and here is Arsen's warning: "Overlaps with…".

[Courses → delete Database Systems] Now, the cascade. I delete the Database Systems course, and the app tells me: two classes will be deleted, and four tasks will stay but without a course. **Delete.**

[Settings → dark mode, Database inspector] Here we can switch to dark mode. And here is our **Database inspector**: these are the real rows stored in the browser.

[Press F5.] And finally, I refresh the page… and **everything is still here**. The data is saved.

[Back to the slides.]

So that is UniTask in action! Arslan, can you sum it up for us?

---

## 5. Arslan: closing

[Slide 14, results and next steps.]

Thank you, Amirkhan! That was a great demo.

So let's go back to our research question: how can a web platform help students organize their studies?

Our answer is: **by putting everything in one place.** With UniTask, a student opens one page and sees tasks, deadlines, classes, notes and progress together. All **six modules** from our plan are ready: Dashboard, Tasks, Schedule, Notes, Progress and Settings.

Of course, we also see the **limits** of our prototype. Right now the data lives in **one browser**, so there is no sync between your laptop and your phone. For now, you can export a backup file.

So, what's next? First, we will finish our **survey** and run **user testing** with real students, and we will improve UniTask based on their feedback. After that, we have big plans for **version two**: user accounts, **cloud sync**, **deadline reminders**, and a version you can install on your phone.

We started this project because **we** were tired of losing deadlines. Now we believe UniTask can help **every** student feel a little less stressed and a lot more organized.

[Slide 15, Questions. Short pause.]

Thank you very much for your attention! We are happy to answer your questions.

---

## Tips for the team

* **Practice the handovers.** Each part ends with a line that passes the word to the next person, so the talk sounds like one story.
* **Reset the demo** before the talk: *Settings → Reset demo data*. Then the overdue and upcoming tasks always look right.
* **Backup plan:** if the internet or the laptop fails, Amirkhan shows the screenshots from `docs/screenshots/` instead of the live demo.
* **Who answers which questions:**
  * research, survey, competitors → **Ruslan**
  * design, mobile, schedule, notes → **Arsen**
  * code, database, LocalStorage, security, tests → **Amirkhan**
  * future plans and "why this project" → **Arslan**
* Ready answers to the most likely questions are in `docs/PRESENTATION.md` → *Возможные вопросы и ответы*.
