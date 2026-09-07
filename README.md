# Exam Room Timer

An early interface prototype for a browser-based custom and QCAA exam-room timer.

The app includes sourced presets for every QCAA General subject with an external assessment. It remains a draft application and must be checked against the assessment instrument and current QCAA administration directions before use in an examination.

The draft includes distinct subject colours, a configurable per-exam permitted leaving window, enlarged room-readable timings, a supervisor setup panel, and a viewport-fitted full-screen display.

Permitted leaving windows are shown only in the supervisor setup panel, not on the student-facing room display.

Supervisors can configure between one and three simultaneous exams. Exams are added from the bar below the room display and removed from an exam's own quick-edit dialog; the last exam cannot be removed.

Session start time and setup are stored in the browser so they survive an accidental tab or browser closure. Browser storage is local to the device and browser profile in use.

Session start sits in the top bar, next to the clock. Its shortcuts are the QCAA EA morning and afternoon sessions and the supplied school timetable's Periods 1–6, offset five minutes from each period start.

Fixed start-time choices apply immediately. The editable time field and current-browser-time shortcut are shown only when manual start time is selected.

Custom exams can be saved into a separate reusable preset library in the browser. Saved options can be selected, updated or deleted in later sessions.

Both 5-minutes-per-30 and 10-minutes-per-30 AARA groups can be enabled for the same exam, with a separate finish time shown for each group.

Countdowns are recalculated against the browser clock every second, including waiting, perusal/planning, working, AARA extra time, and finished states.

## QCAA data included

Presets cover 48 General subjects and 163 entries, in `presets.js`.

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

### Units 1–2 (FIA)

The syllabuses prescribe **no** Units 1–2 timings — schools develop their own
programs. Each subject therefore has one FIA entry that mirrors that subject's own
summative instrument (its timed internal assessment where it has one, otherwise its
external assessment), labelled *FIA — mirrors IA1 Data test* and sourced as
"Units 1–2 school-developed" rather than citing the syllabus for a time it does not
give.

Because these are school-set, changing an FIA's perusal or working time is
remembered against that FIA and reapplied next time it is chosen. Setting it back to
the mirrored values forgets the override, and **Restore sample** clears them all.
Syllabus-prescribed timings are never overridden this way.

### Scheduled starts

An external assessment measures its leaving window from the scheduled QCAA session,
so a late start does not let students leave early. The same applies to a school
exam: setting a **scheduled period start** anchors the teacher-defined leaving
window to that period rather than to when the timer was actually started, and the
period is shown on the exam card. Exams default to *not scheduled*, which measures
from the actual start.

`tests/qcaa-presets.test.js` checks the dataset: unique ids, a positive working time
and a syllabus version and URL on every preset, the EA leaving rule on every external
assessment, and a set of timings pinned to the syllabuses they were read from.

Applied subjects and Short Courses are excluded, as they have no external assessment.

## Preview locally

Open `index.html` in a browser. No build process or dependencies are required.

## Deploy

This is a static site and can be imported directly into Vercel. Future versions can add structured, versioned QCAA data without changing the display architecture.
