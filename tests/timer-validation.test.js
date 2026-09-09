const assert = require('node:assert/strict');

// These come from the files the browser actually loads, so a regression in the
// app fails here. Do not re-implement any of this logic in the test.
const {
  aaraRates,
  normalizeExam,
  examProblem,
  validateExam,
  migrateLegacyExam,
  createExamTimeline,
  formatRemaining,
  periodLabel,
  timingWord,
  timingTitle,
} = require('../timer-core.js');
const { QCAA_EA_DIRECTIONS } = require('../presets.js');

const SAMPLE_EXAM = {
  name: 'Sample Mathematics — Paper 1', type: 'EA', perusal: 5, working: 90,
  aaraOptions: [5, 10], leaveAfterStart: 30, noLeaveBeforeEnd: 15,
  leavingPolicy: 'teacher', colour: 'blue', presetId: 'manual',
};

const at = (hour, minute) => new Date(2026, 8, 7, hour, minute, 0).getTime();
const START = new Date(at(9, 0));

// --- validation -----------------------------------------------------------
assert.equal(validateExam(SAMPLE_EXAM), true, 'sample exam should validate');
assert.equal(examProblem(SAMPLE_EXAM), null, 'sample exam should report no problem');

assert.deepEqual(
  examProblem({ ...SAMPLE_EXAM, name: '   ' }),
  { field: 'name', message: 'Enter a display name for this exam.' },
  'a blank name should be reported against the name field',
);

assert.equal(examProblem({ ...SAMPLE_EXAM, perusal: -1 }).field, 'perusal', 'negative perusal is rejected');
assert.equal(examProblem({ ...SAMPLE_EXAM, working: 'abc' }).field, 'working', 'non-numeric working time is rejected');

// An empty number input reaches validation as null, and Number(null) is 0, so this
// is the case that silently became a 0-minute exam when normalisation ran first.
assert.equal(examProblem({ ...SAMPLE_EXAM, working: null }).field, 'working', 'an empty working time is rejected, not read as 0');
assert.equal(examProblem({ ...SAMPLE_EXAM, leaveAfterStart: null }).field, 'leaveAfterStart', 'an empty leaving field is rejected');

// The QCAA policy sets its own leaving window, so those two fields may be blank.
assert.equal(
  validateExam({ ...SAMPLE_EXAM, leavingPolicy: 'qcaa-ea-2025', leaveAfterStart: null, noLeaveBeforeEnd: null }),
  true,
  'QCAA EA exams do not require teacher-defined leaving fields',
);

// --- normalisation and legacy migration -----------------------------------
const normalized = normalizeExam({ name: 'X', perusal: '10', working: '90', leaveAfterStart: -5 });
assert.equal(normalized.perusal, 10, 'numeric strings are coerced');
assert.equal(normalized.leaveAfterStart, 0, 'negative values are clamped');
assert.equal(normalized.leavingPolicy, 'teacher', 'an unknown leaving policy falls back to teacher-defined');

// Pre-policy saves measured "cannot leave for first N minutes" from the start of
// working time; folding perusal back in keeps an old saved session accurate.
assert.equal(
  migrateLegacyExam({ name: 'Old', perusal: 10, working: 90, leaveAfterStart: 30 }).leaveAfterStart,
  40,
  'a legacy exam has perusal folded into its leaving offset',
);
assert.equal(
  migrateLegacyExam(SAMPLE_EXAM).leaveAfterStart,
  30,
  'a current exam is left untouched by the migration',
);

// --- timeline -------------------------------------------------------------
const timeline = createExamTimeline(SAMPLE_EXAM, START, QCAA_EA_DIRECTIONS);
assert.equal(timeline.startMs, at(9, 0), 'the exam starts at the session start');
assert.equal(timeline.workingStartMs, at(9, 5), 'working time starts after perusal');
assert.equal(timeline.finishMs, at(10, 35), 'working time ends after perusal plus working');
assert.equal(timeline.warningMs, at(10, 25), 'the warning lands 10 minutes before the finish');
assert.equal(timeline.leavingStartMs, at(9, 30), 'leaving opens after the teacher-defined offset');
assert.equal(timeline.leavingEndMs, at(10, 20), 'leaving closes before the teacher-defined final period');

assert.equal(aaraRates(SAMPLE_EXAM).length, 2, 'AARA rates should be retained');
assert.equal(timeline.aaraFinishByRate[5], at(10, 50), '+5/30 on 90 minutes adds 15 minutes');
assert.equal(timeline.aaraFinishByRate[10], at(11, 5), '+10/30 on 90 minutes adds 30 minutes');
assert.equal(timeline.aaraFinishMs, at(11, 5), 'the room clears at the longest AARA finish');

// The QCAA leaving window is measured from the scheduled session, not from when
// the supervisor actually started the timer.
const lateStart = createExamTimeline(
  { ...SAMPLE_EXAM, leavingPolicy: 'qcaa-ea-2025', eaScheduledStart: '09:00' },
  new Date(at(9, 10)),
  QCAA_EA_DIRECTIONS,
);
assert.equal(
  lateStart.leavingStartMs,
  at(9, 0) + QCAA_EA_DIRECTIONS.firstMinutesFromScheduledStart * 60_000,
  'QCAA leaving opens 40 minutes after the scheduled start, not the actual start',
);

// "No leaving window" reports no window rather than an empty or invalid one, and it
// does not need the two teacher-defined offsets to be filled in.
const noWindow = createExamTimeline(
  { ...SAMPLE_EXAM, leavingPolicy: 'none' },
  START,
  QCAA_EA_DIRECTIONS,
);
assert.equal(noWindow.leavingStartMs, null, 'the no-window policy reports no leaving start');
assert.equal(noWindow.leavingEndMs, null, 'the no-window policy reports no leaving end');
assert.equal(noWindow.finishMs, at(10, 35), 'the no-window policy leaves the working times alone');
assert.equal(
  validateExam({ name: 'No leaving', perusal: 5, working: 90, leavingPolicy: 'none' }),
  true,
  'the no-window policy does not require the two leaving offsets',
);

// --- countdown formatting -------------------------------------------------
assert.equal(formatRemaining(90 * 60_000, true), '1:30:00', 'full format shows hours, minutes and seconds');
assert.equal(formatRemaining(59_000, true), '0:00:59', 'the final minute counts down in seconds');

// With seconds hidden the display must round UP: showing 0:00 while working time
// is still running would have a supervisor calling time up to a minute early.
assert.equal(formatRemaining(59_000, false), '0:01', '59 seconds remaining reads as 1 minute, not 0');
assert.equal(formatRemaining(1_000, false), '0:01', '1 second remaining still reads as 1 minute');
assert.equal(formatRemaining(60_000, false), '0:01', 'exactly 1 minute reads as 1 minute');
assert.equal(formatRemaining(60_001, false), '0:02', 'just over 1 minute rounds up');
assert.equal(formatRemaining(90 * 60_000, false), '1:30', 'exact durations do not gain a minute');
assert.equal(formatRemaining(0, false), '0:00', 'only a finished exam reads 0:00');
assert.equal(formatRemaining(-5_000, false), '0:00', 'overrun clamps to 0:00');

// --- a timetabled period anchors the leaving window -----------------------
// Without this, a late start would let students leave late; with it, the window is
// measured from the period the exam was scheduled in, matching the QCAA EA rule.
const lateActualStart = new Date(at(11, 18));
const scheduled = createExamTimeline(
  { ...SAMPLE_EXAM, perusal: 0, working: 70, leaveAfterStart: 30, noLeaveBeforeEnd: 10, scheduledPeriodStart: '11:10' },
  lateActualStart,
  QCAA_EA_DIRECTIONS,
);
assert.equal(scheduled.leavingStartMs, at(11, 40), 'leaving opens 30 minutes after the scheduled period start');

const unscheduled = createExamTimeline(
  { ...SAMPLE_EXAM, perusal: 0, working: 70, leaveAfterStart: 30, noLeaveBeforeEnd: 10 },
  lateActualStart,
  QCAA_EA_DIRECTIONS,
);
assert.equal(unscheduled.leavingStartMs, at(11, 48), 'with no period set, it is still measured from the actual start');

// The QCAA rule keeps precedence over a period, and an unknown period is ignored.
const qcaaWins = createExamTimeline(
  { ...SAMPLE_EXAM, leavingPolicy: 'qcaa-ea-2025', eaScheduledStart: '09:00', scheduledPeriodStart: '11:10' },
  lateActualStart,
  QCAA_EA_DIRECTIONS,
);
assert.equal(qcaaWins.leavingStartMs, at(9, 40), 'the QCAA scheduled session still wins for an EA');

assert.equal(normalizeExam({ scheduledPeriodStart: '07:00' }).scheduledPeriodStart, '', 'a time outside the timetable is discarded');
assert.equal(normalizeExam({ scheduledPeriodStart: '11:10' }).scheduledPeriodStart, '11:10', 'a timetabled period is kept');
assert.equal(normalizeExam({}).scheduledPeriodStart, '', 'exams are unscheduled by default');
assert.equal(periodLabel('11:10'), 'Period 3', 'periods are named for the card');
assert.equal(periodLabel('07:00'), '', 'an unknown time has no period name');

// --- perusal and planning ------------------------------------------------
assert.equal(timingWord(normalizeExam({ name: "X", timing: "planning" })), "planning", "a planning exam keeps planning");
assert.equal(timingWord(normalizeExam({ name: "X", timing: "perusal" })), "perusal", "a perusal exam keeps perusal");
// Perusal is the stricter of the two, so an unset or bad value falls back to it.
assert.equal(timingWord(normalizeExam({ name: "X" })), "perusal", "an exam typed in by hand defaults to perusal");
assert.equal(timingWord(normalizeExam({ name: "X", timing: "whatever" })), "perusal", "an unknown kind falls back to perusal");
assert.equal(timingTitle(normalizeExam({ name: "X", timing: "planning" })), "Planning", "titles are capitalised for the display");

console.log('All timer validation checks passed.');
