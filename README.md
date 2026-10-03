# Study

My study schedule for 1A Electrical Engineering at Waterloo, live at [quaot.github.io/study](https://quaot.github.io/study/).
It uses the same design as my [portfolio](https://quaot.github.io).

It shows:
- **Today:** the day's 50-minute blocks, which one is running now, and a button that copies my scores into a report.
- **The week:** weekdays are same-day reviews, Saturday is a cumulative review, Sunday goes forward in the syllabus.
- **Courses:** every topic, colour-coded by whether it was reviewed in the last week, is due again or weak, was taught but never reviewed, or hasn't been taught yet.
- **Due for review:** the topics a cumulative review should cover first.
- **Deadlines** and **the log** of every review, with scores and missed questions.

## How it updates

Everything comes from one file, [`data/study.json`](data/study.json). After each block I send the copied report to
Claude, and Claude updates the file:

| Field | What it holds |
|---|---|
| `courses[].topics` | Each topic with `taught` (date) or `expected` (date not yet reached) |
| `days[].blocks` | The plan for each day: `start`, `end`, `course`, `title`, `doc`, `covers` (topic ids), `status`, `score`, `missed` |
| `reviews` | Practice from before this site existed |
| `weak` | `{ "course": "m117", "topic": "pfrac" }` entries, which go to the top of the due list |
| `deadlines` | `date` (optional), `course`, `title`, `weight`, `note` |

A topic counts as reviewed when a block that lists it in `covers` is marked `done`. Ticks and scores typed on the
page stay in that browser until they're reported.

No course material is published here, only topic names, plans and scores.

Preview locally with `python -m http.server` in this folder.
