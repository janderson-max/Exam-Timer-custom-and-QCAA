// Guards the QCAA preset dataset. These timings decide how long students actually
// get, so the shape and provenance of every entry is checked, and a few values are
// pinned against the syllabuses they were read from.
const assert = require('node:assert/strict');

const { QCAA_PRESETS, QCAA_SUBJECTS, QCAA_EA_DIRECTIONS } = require('../presets.js');
const { normalizeExam, validateExam, createExamTimeline } = require('../timer-core.js');

// --- shape and provenance -------------------------------------------------
assert.ok(QCAA_SUBJECTS.length >= 40, 'the full General subject list should be present');
assert.ok(QCAA_PRESETS.length >= 100, 'every timed instrument should produce a preset');

const ids = QCAA_PRESETS.map(preset => preset.id);
assert.equal(ids.length, new Set(ids).size, 'preset ids must be unique');

for (const preset of QCAA_PRESETS) {
  const where = preset.id;
  assert.ok(preset.subject, `${where}: needs a subject`);
  assert.ok(preset.label, `${where}: needs an instrument label`);
  assert.match(preset.type, /^(IA|EA)$/, `${where}: type must be IA or EA`);

  // A missing or zero working time would silently produce a 0-minute exam.
  assert.ok(Number.isInteger(preset.working) && preset.working > 0, `${where}: working time must be a positive whole number of minutes`);
  assert.ok(Number.isInteger(preset.perusal) && preset.perusal >= 0, `${where}: perusal/planning must be a whole number of minutes`);
  assert.ok(preset.working <= 240 && preset.perusal <= 60, `${where}: times should be within a plausible range`);

  // Provenance: every timing must name the syllabus version it came from.
  assert.match(preset.source, /20\d\d v[\d.]+ \(\w+ 20\d\d\)$/, `${where}: source must carry a syllabus version`);
  assert.match(preset.sourceUrl, /^https:\/\/www\.qcaa\.qld\.edu\.au\/.*_syll\.pdf$/, `${where}: sourceUrl must point at a QCAA syllabus PDF`);

  // Every preset must survive the app's own validation and produce a sane timeline.
  assert.equal(validateExam(normalizeExam(preset)), true, `${where}: should pass the app's exam validation`);
}

// --- the QCAA external assessment leaving rule ----------------------------
for (const preset of QCAA_PRESETS.filter(p => p.type === 'EA')) {
  assert.equal(preset.leavingPolicy, 'qcaa-ea-2025', `${preset.id}: EA must use the QCAA leaving policy`);
  assert.equal(preset.leaveAfterStart, QCAA_EA_DIRECTIONS.firstMinutesFromScheduledStart, `${preset.id}: EA leaving offset`);
  assert.equal(preset.noLeaveBeforeEnd, QCAA_EA_DIRECTIONS.finalMinutes, `${preset.id}: EA final restricted period`);
}
for (const preset of QCAA_PRESETS.filter(p => p.type === 'IA')) {
  assert.equal(preset.leavingPolicy, 'teacher', `${preset.id}: internal assessment leaving is teacher-defined`);
  assert.equal(preset.leaveAfterStart, null, `${preset.id}: internal leaving window must be left blank`);
}

// --- values pinned to the syllabuses they were read from ------------------
const find = id => {
  const preset = QCAA_PRESETS.find(p => p.id === id);
  assert.ok(preset, `expected preset ${id} to exist`);
  return preset;
};
const timing = id => [find(id).perusal, find(id).working];

// Mathematics: unchanged from the original hand-sourced presets, so these double as
// a regression check on the whole extraction pipeline.
assert.deepEqual(timing('qcaa-general-mathematics-ea-p1'), [5, 90], 'General Mathematics EA Paper 1');
assert.deepEqual(timing('qcaa-general-mathematics-ea-p2'), [5, 90], 'General Mathematics EA Paper 2');
assert.deepEqual(timing('qcaa-general-mathematics-ia2'), [5, 90], 'General Mathematics IA2');
assert.deepEqual(timing('qcaa-mathematical-methods-ea-p1'), [5, 90], 'Mathematical Methods EA Paper 1');
assert.deepEqual(timing('qcaa-specialist-mathematics-ea-p1'), [5, 90], 'Specialist Mathematics EA Paper 1');

// Sciences: the timed internal is IA1 (a 60-minute data test), not IA2/IA3.
assert.deepEqual(timing('qcaa-biology-ia1'), [5, 60], 'Biology IA1 data test');
assert.deepEqual(timing('qcaa-biology-ea-p1'), [5, 90], 'Biology EA Paper 1');
assert.deepEqual(timing('qcaa-physics-ia1'), [5, 60], 'Physics IA1 data test');

// English uses planning time, and its external assessment is a single paper.
assert.deepEqual(timing('qcaa-english-ea'), [15, 120], 'English EA');
assert.equal(find('qcaa-english-ea').timing ?? 'planning', 'planning', 'English uses planning time');
assert.equal(QCAA_PRESETS.filter(p => p.id.startsWith('qcaa-english-ea')).length, 1, 'English EA is a single paper');

// Languages: IA2 is one instrument with two separately timed components.
assert.deepEqual(timing('qcaa-japanese-ia2-extended-response'), [10, 80], 'Japanese IA2 extended response');
assert.deepEqual(timing('qcaa-japanese-ia2-conversation'), [10, 7], 'Japanese IA2 conversation');

// --- a preset drives a correct timeline -----------------------------------
const start = new Date(2026, 9, 26, 9, 0, 0);
const bio = createExamTimeline(normalizeExam(find('qcaa-biology-ea-p1')), start, QCAA_EA_DIRECTIONS);
assert.equal(bio.workingStartMs, new Date(2026, 9, 26, 9, 5, 0).getTime(), 'working starts after 5 minutes perusal');
assert.equal(bio.finishMs, new Date(2026, 9, 26, 10, 35, 0).getTime(), 'working ends 90 minutes later');
assert.equal(bio.leavingStartMs, new Date(2026, 9, 26, 9, 40, 0).getTime(), 'QCAA leaving opens 40 minutes after the scheduled start');

console.log(`All QCAA preset checks passed (${QCAA_SUBJECTS.length} subjects, ${QCAA_PRESETS.length} instruments).`);
