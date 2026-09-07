# Exam Room Timer

An early interface prototype for a browser-based custom and QCAA exam-room timer.

The app includes sourced presets for every QCAA General subject with an external assessment. It remains a draft application and must be checked against the assessment instrument and current QCAA administration directions before use in an examination.

The draft includes distinct subject colours, a configurable per-exam permitted leaving window, enlarged room-readable timings, a supervisor setup panel, and a viewport-fitted full-screen display.

Permitted leaving windows are shown only in the supervisor setup panel, not on the student-facing room display.

Supervisors can configure between one and three simultaneous exams.

Session start time and setup are stored in the browser so they survive an accidental tab or browser closure. Browser storage is local to the device and browser profile in use.

Start-time shortcuts include the QCAA EA morning and afternoon sessions and the supplied school timetable's Periods 1–6, offset five minutes from each period start.

Fixed start-time choices apply immediately. The editable time field and current-browser-time shortcut are shown only when manual start time is selected.

Custom exams can be saved into a separate reusable preset library in the browser. Saved options can be selected, updated or deleted in later sessions.

Both 5-minutes-per-30 and 10-minutes-per-30 AARA groups can be enabled for the same exam, with a separate finish time shown for each group.

Countdowns are recalculated against the browser clock every second, including waiting, perusal/planning, working, AARA extra time, and finished states.

## QCAA data included

Presets cover 48 General subjects and 115 timed instruments, in `presets.js`.

Each timing is taken from that subject’s syllabus PDF, extracted from the document
rather than transcribed by hand, and carries the syllabus version it came from. The
source is linked from each preset in the setup panel.

Only instruments the syllabus states a time for are included, so the set varies by
subject rather than following a fixed template:

- **Which internal assessment is a timed examination differs.** Sciences time IA1 (a 60-minute data test); English times IA3; the mathematics subjects time IA2 and IA3. A subject’s other internal assessments are portfolios, performances or investigations and are not listed.
- **Perusal time and planning time both occur.** Sciences and mathematics use perusal; English, humanities and the arts use planning. Both map to the app’s single perusal/planning field.
- **External assessments may be one paper or two.** Mathematics and the sciences have Paper 1 and Paper 2; English and most humanities subjects have a single paper.
- **Some instruments have separately timed components.** In the languages, IA2 is one examination with an extended response (10 + 80) and a conversation (10 + 7), listed separately.
- **EA leaving rule:** not in the first 40 minutes from the scheduled session start, or the final 10 minutes. Applied to every external assessment preset.
- **Internal assessment leaving windows are left blank**, because they are teacher-defined.

Units 1–2 formative assessment is not listed: the syllabuses require schools to
develop their own Units 1–2 programs and do not prescribe timings. Use *Custom /
manual exam* for those.

`tests/qcaa-presets.test.js` checks the dataset: unique ids, a positive working time
and a syllabus version and URL on every preset, the EA leaving rule on every external
assessment, and a set of timings pinned to the syllabuses they were read from.

Applied subjects and Short Courses are excluded, as they have no external assessment.

## Preview locally

Open `index.html` in a browser. No build process or dependencies are required.

## Deploy

This is a static site and can be imported directly into Vercel. Future versions can add structured, versioned QCAA data without changing the display architecture.
