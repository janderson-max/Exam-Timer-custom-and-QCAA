// Pure exam-timing helpers shared by the browser app and the Node test suite.
// Nothing in here may touch the DOM or browser storage: tests/timer-validation.test.js
// requires this file directly, so a DOM reference would break the suite and, more
// importantly, would let the tested code drift away from what the app runs.

const EXAM_COLOURS = ["blue", "purple", "teal", "orange", "rose"];
const VALID_LEAVING_POLICIES = new Set(["teacher", "qcaa-ea-2025"]);
const VALID_TIMING_KINDS = new Set(["perusal", "planning"]);

// "Perusal" is reading only; "planning" allows writing.
function timingWord(exam) {
  return exam && exam.timing === "planning" ? "planning" : "perusal";
}

function timingTitle(exam) {
  return timingWord(exam) === "planning" ? "Planning" : "Perusal";
}

// The school timetable, matching the session-start shortcuts in the setup panel
// (each is the period start plus five minutes).
const SCHOOL_PERIODS = [
  { value: "08:40", label: "Period 1", time: "8:40 am" },
  { value: "09:35", label: "Period 2", time: "9:35 am" },
  { value: "11:10", label: "Period 3", time: "11:10 am" },
  { value: "12:05", label: "Period 4", time: "12:05 pm" },
  { value: "13:40", label: "Period 5", time: "1:40 pm" },
  { value: "14:30", label: "Period 6", time: "2:30 pm" },
];

function periodLabel(value) {
  const period = SCHOOL_PERIODS.find(item => item.value === value);
  return period ? period.label : "";
}

function aaraRates(exam) {
  if (Array.isArray(exam.aaraOptions)) {
    return [...new Set(exam.aaraOptions.map(Number).filter(rate => rate === 5 || rate === 10))].sort((a, b) => a - b);
  }
  const legacyRate = Number(exam.aara);
  return legacyRate === 5 || legacyRate === 10 ? [legacyRate] : [];
}

function aaraFinishTimes(exam, finishMs) {
  return Object.fromEntries(aaraRates(exam).map(rate => [
    rate,
    finishMs + Math.round((exam.working / 30) * rate) * 60_000,
  ]));
}

function normalizeExam(exam = {}, fallback = {}) {
  const base = { ...fallback, ...(exam ?? {}) };
  const leavingPolicy = VALID_LEAVING_POLICIES.has(base.leavingPolicy) ? base.leavingPolicy : "teacher";
  const perusal = Number(base.perusal);
  const working = Number(base.working);
  const leaveAfterStart = Number(base.leaveAfterStart);
  const noLeaveBeforeEnd = Number(base.noLeaveBeforeEnd);

  return {
    ...base,
    name: String(base.name ?? fallback.name ?? "Custom exam"),
    type: String(base.type ?? fallback.type ?? "Custom").replace(" sample", ""),
    perusal: Number.isFinite(perusal) ? Math.max(0, perusal) : 0,
    working: Number.isFinite(working) ? Math.max(0, working) : 0,
    aaraOptions: aaraRates(base),
    leaveAfterStart: Number.isFinite(leaveAfterStart) ? Math.max(0, leaveAfterStart) : 0,
    noLeaveBeforeEnd: Number.isFinite(noLeaveBeforeEnd) ? Math.max(0, noLeaveBeforeEnd) : 0,
    leavingPolicy,
    presetId: typeof base.presetId === "string" ? base.presetId : "manual",
    colour: typeof base.colour === "string" ? base.colour : EXAM_COLOURS[0],
    eaScheduledStart: typeof base.eaScheduledStart === "string" ? base.eaScheduledStart : "09:00",
    timing: VALID_TIMING_KINDS.has(base.timing) ? base.timing : "perusal",
    // "" means the exam is not tied to a timetabled period, which is the default and
    // leaves the leaving window measured from when the exam actually starts.
    scheduledPeriodStart: SCHOOL_PERIODS.some(period => period.value === base.scheduledPeriodStart)
      ? base.scheduledPeriodStart
      : "",
  };
}

// Returns the first problem as { field, message } so the caller can point the
// supervisor at the offending input, or null when the exam is usable.
function examProblem(exam) {
  const source = exam ?? {};
  const leavingPolicy = source.leavingPolicy ?? "teacher";

  if (!String(source.name ?? "").trim()) {
    return { field: "name", message: "Enter a display name for this exam." };
  }
  if (!VALID_LEAVING_POLICIES.has(leavingPolicy)) {
    return { field: "leavingPolicy", message: "Choose a valid leaving-rules option." };
  }

  const timingFields = [["perusal", "Perusal / planning"], ["working", "Working time"]];
  if (leavingPolicy === "teacher") {
    timingFields.push(
      ["leaveAfterStart", "Cannot leave for first"],
      ["noLeaveBeforeEnd", "Cannot leave during final"],
    );
  }

  for (const [field, label] of timingFields) {
    const raw = source[field];
    // An empty editor field arrives as null, and Number(null) is 0, so check first.
    const value = raw === null || raw === undefined || raw === "" ? Number.NaN : Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      return { field, message: `Enter a number of minutes for “${label}”.` };
    }
  }
  return null;
}

function validateExam(exam) {
  return examProblem(exam) === null;
}

function migrateLegacyExam(exam) {
  const source = exam ?? {};
  if (source.leavingPolicy) return source;
  // Saves made before the leaving-policy model measured "cannot leave for first
  // N minutes" from the start of working time; it is now measured from the start
  // of the session, so fold perusal back in.
  return { ...source, leaveAfterStart: Number(source.leaveAfterStart || 0) + Number(source.perusal || 0) };
}

function durationLabel(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return [hours ? `${hours} hr${hours === 1 ? "" : "s"}` : "", mins ? `${mins} min` : ""].filter(Boolean).join(" ");
}

function formatRemaining(milliseconds, showSeconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));

  if (!showSeconds) {
    // Round up to the next whole minute so the final minute reads 0:01 rather than
    // 0:00; a supervisor must never see zero while working time is still running.
    const totalMinutes = Math.ceil(totalSeconds / 60);
    return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function createExamTimeline(exam, start, directions) {
  const normalizedExam = normalizeExam(exam);
  const scheduledStartMs = start.getTime();
  const scheduledWorkingStartMs = scheduledStartMs + normalizedExam.perusal * 60_000;
  const scheduledFinishMs = scheduledWorkingStartMs + normalizedExam.working * 60_000;
  const runtime = normalizedExam.runtime;
  const startMs = Number(runtime?.sessionStartMs) || scheduledStartMs;
  const workingStartMs = Number(runtime?.workingStartMs) || scheduledWorkingStartMs;
  const finishMs = Number(runtime?.finishMs) || scheduledFinishMs;
  const calculatedAaraFinishes = aaraFinishTimes(normalizedExam, finishMs);
  const aaraFinishByRate = Object.fromEntries(aaraRates(normalizedExam).map(rate => [
    rate,
    Number(runtime?.aaraFinishByRate?.[rate]) || calculatedAaraFinishes[rate],
  ]));
  const aaraFinishMs = Math.max(finishMs, ...Object.values(aaraFinishByRate).map(Number));
  const scheduledClockTime = clock => {
    const [hour, minute] = clock.split(":").map(Number);
    const scheduled = new Date(start);
    scheduled.setHours(hour, minute, 0, 0);
    return scheduled.getTime();
  };

  let leavingStartMs = startMs + Number(normalizedExam.leaveAfterStart) * 60_000;
  if (normalizedExam.leavingPolicy === "qcaa-ea-2025") {
    leavingStartMs = scheduledClockTime(normalizedExam.eaScheduledStart || "09:00")
      + directions.firstMinutesFromScheduledStart * 60_000;
  } else if (normalizedExam.scheduledPeriodStart) {
    leavingStartMs = scheduledClockTime(normalizedExam.scheduledPeriodStart)
      + Number(normalizedExam.leaveAfterStart) * 60_000;
  }

  return {
    startMs,
    workingStartMs,
    warningMs: Math.max(workingStartMs, finishMs - 10 * 60_000),
    finishMs,
    aaraFinishMs,
    aaraFinishByRate,
    leavingStartMs,
    leavingEndMs: finishMs - Number(normalizedExam.noLeaveBeforeEnd) * 60_000,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    EXAM_COLOURS,
    VALID_LEAVING_POLICIES,
    VALID_TIMING_KINDS,
    timingWord,
    timingTitle,
    aaraRates,
    aaraFinishTimes,
    createExamTimeline,
    SCHOOL_PERIODS,
    periodLabel,
    normalizeExam,
    examProblem,
    validateExam,
    migrateLegacyExam,
    durationLabel,
    formatRemaining,
  };
}
