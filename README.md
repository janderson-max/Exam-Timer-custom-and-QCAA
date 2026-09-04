# Exam Room Timer

An early interface prototype for a browser-based custom and QCAA exam-room timer.

The app includes sourced 2025-syllabus presets for General Mathematics, Mathematical Methods and Specialist Mathematics. It remains a draft application and must be checked against the assessment instrument and current QCAA administration directions before use in an examination.

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

- IA2 and IA3 examinations: 5 minutes perusal and 90 minutes working for all three included mathematics subjects.
- EA Paper 1 and Paper 2: 5 minutes perusal and 90 minutes working for all three included mathematics subjects.
- EA leaving rule: not in the first 40 minutes from the scheduled session start or the final 10 minutes.
- FIA: teacher-defined. The 2025 syllabuses require schools to develop Units 1–2 assessment programs but do not prescribe FIA examination timings.

Sources are linked from each preset in the setup panel. The data currently follows General Mathematics 2025 v1.3, Mathematical Methods 2025 v1.3, Specialist Mathematics 2025 v1.4, and *Directions for students: External assessment* (June 2025).

## Preview locally

Open `index.html` in a browser. No build process or dependencies are required.

## Deploy

This is a static site and can be imported directly into Vercel. Future versions can add structured, versioned QCAA data without changing the display architecture.
