const assert = require('node:assert/strict');

const SAMPLE_EXAMS = [
  { name: 'Sample Mathematics — Paper 1', type: 'EA', perusal: 5, working: 90, aaraOptions: [5, 10], leaveAfterStart: 30, noLeaveBeforeEnd: 15, leavingPolicy: 'teacher', colour: 'blue', presetId: 'manual' },
  { name: 'Sample English — Written response', type: 'IA', perusal: 10, working: 120, aaraOptions: [], leaveAfterStart: 60, noLeaveBeforeEnd: 30, leavingPolicy: 'teacher', colour: 'purple', presetId: 'manual' },
  { name: 'Custom Year 11 Science', type: 'Custom', perusal: 10, working: 100, aaraOptions: [10], leaveAfterStart: 30, noLeaveBeforeEnd: 15, leavingPolicy: 'teacher', colour: 'teal', presetId: 'manual' },
];

function aaraRates(exam) {
  if (Array.isArray(exam.aaraOptions)) {
    return [...new Set(exam.aaraOptions.map(Number).filter(rate => rate === 5 || rate === 10))].sort((a, b) => a - b);
  }
  const legacyRate = Number(exam.aara);
  return legacyRate === 5 || legacyRate === 10 ? [legacyRate] : [];
}

function normalizeExam(exam = {}, fallback = {}) {
  const base = { ...fallback, ...(exam ?? {}) };
  const leavingPolicy = ['teacher', 'qcaa-ea-2025'].includes(base.leavingPolicy) ? base.leavingPolicy : 'teacher';
  const perusal = Number(base.perusal);
  const working = Number(base.working);
  const leaveAfterStart = Number(base.leaveAfterStart);
  const noLeaveBeforeEnd = Number(base.noLeaveBeforeEnd);

  return {
    ...base,
    name: String(base.name ?? fallback.name ?? 'Custom exam'),
    type: String(base.type ?? fallback.type ?? 'Custom').replace(' sample', ''),
    perusal: Number.isFinite(perusal) ? Math.max(0, perusal) : 0,
    working: Number.isFinite(working) ? Math.max(0, working) : 0,
    aaraOptions: aaraRates(base),
    leaveAfterStart: Number.isFinite(leaveAfterStart) ? Math.max(0, leaveAfterStart) : 0,
    noLeaveBeforeEnd: Number.isFinite(noLeaveBeforeEnd) ? Math.max(0, noLeaveBeforeEnd) : 0,
    leavingPolicy,
    presetId: typeof base.presetId === 'string' ? base.presetId : 'manual',
    colour: typeof base.colour === 'string' ? base.colour : 'blue',
    eaScheduledStart: typeof base.eaScheduledStart === 'string' ? base.eaScheduledStart : '09:00',
  };
}

function validateExam(exam) {
  const source = exam ?? {};
  const name = String(source.name ?? '');
  const perusal = Number(source.perusal);
  const working = Number(source.working);
  const leaveAfterStart = Number(source.leaveAfterStart);
  const noLeaveBeforeEnd = Number(source.noLeaveBeforeEnd);
  const leavingPolicy = source.leavingPolicy ?? 'teacher';

  if (!name.trim()) return false;
  if (!Number.isFinite(perusal) || !Number.isFinite(working)) return false;
  if (perusal < 0 || working < 0) return false;
  if (leavingPolicy === 'teacher') {
    if (!Number.isFinite(leaveAfterStart) || !Number.isFinite(noLeaveBeforeEnd)) return false;
    if (leaveAfterStart < 0 || noLeaveBeforeEnd < 0) return false;
    return true;
  }
  return ['teacher', 'qcaa-ea-2025'].includes(leavingPolicy);
}

function createExamTimeline(exam, start = new Date(2026, 8, 7, 9, 0, 0)) {
  const normalizedExam = normalizeExam(exam);
  const scheduledStartMs = start.getTime();
  const scheduledWorkingStartMs = scheduledStartMs + normalizedExam.perusal * 60_000;
  const scheduledFinishMs = scheduledWorkingStartMs + normalizedExam.working * 60_000;
  const aaraFinishByRate = Object.fromEntries(aaraRates(normalizedExam).map(rate => [
    rate,
    scheduledFinishMs + Math.round((normalizedExam.working / 30) * rate) * 60_000,
  ]));
  const aaraFinishMs = Math.max(scheduledFinishMs, ...Object.values(aaraFinishByRate).map(Number));
  return {
    startMs: scheduledStartMs,
    workingStartMs: scheduledWorkingStartMs,
    finishMs: scheduledFinishMs,
    aaraFinishMs,
    aaraFinishByRate,
    leavingStartMs: scheduledStartMs + Number(normalizedExam.leaveAfterStart) * 60_000,
    leavingEndMs: scheduledFinishMs - Number(normalizedExam.noLeaveBeforeEnd) * 60_000,
  };
}

assert.equal(validateExam(SAMPLE_EXAMS[0]), true, 'sample exam should validate');
assert.equal(validateExam({ name: '', perusal: 10, working: 60, leavingPolicy: 'teacher' }), false, 'empty name should be rejected');
assert.equal(validateExam({ name: 'X', perusal: -1, working: 60, leavingPolicy: 'teacher' }), false, 'negative perusal should be rejected');
const timeline = createExamTimeline(SAMPLE_EXAMS[0]);
assert.equal(timeline.startMs, new Date(2026, 8, 7, 9, 0, 0).getTime(), 'start time should be computed');
assert.equal(timeline.finishMs, new Date(2026, 8, 7, 10, 35, 0).getTime(), 'working end should include perusal');
assert.equal(aaraRates(SAMPLE_EXAMS[0]).length, 2, 'AARA rates should be retained');

console.log('All timer validation checks passed.');
